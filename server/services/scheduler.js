// Background job scheduler
// Keeps lines, injuries, and NBA stats fresh automatically

import cron from 'node-cron'
import { fetchAllLines as fetchPrizePicksAll } from './prizepicks.js'
import { fetchUnderdogLines } from './underdog.js'
import { fetchAllESPNGames } from './espn.js'
import { fetchNBAPlayerMap } from './nbaStats.js'
import { fetchInjuryMap } from './espnInjuries.js'
import { enrichLines } from './evEngine.js'
import { generateDailySlip } from './dailySlip.js'
import { settlePendingPicks } from './settlementService.js'
import {
  setLiveLines,
  setNBAPlayerMap,
  setInjuryMap,
  setLastRefresh,
  setESPNGames,
} from '../store.js'

// ── SSE client registry ───────────────────────────────────────────────────────
const sseClients = new Set()

export function addSSEClient(res) { sseClients.add(res) }
export function removeSSEClient(res) { sseClients.delete(res) }

function pushSSE(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`
  for (const client of sseClients) {
    try { client.write(payload) } catch { sseClients.delete(client) }
  }
}

// Track previous line snapshot for movement detection
let previousLineSnapshot = {}  // id → line value

let isRefreshing = false

// ── Full refresh pipeline ─────────────────────────────────────────────────────
export async function runFullRefresh() {
  if (isRefreshing) return
  isRefreshing = true
  const start = Date.now()

  try {
    console.log('[scheduler] Starting full refresh...')

    // Fetch all sources in parallel — PrizePicks primary, Underdog fills gaps
    const [ppResult, udResult, injuries, espnGames] = await Promise.allSettled([
      fetchPrizePicksAll(),
      fetchUnderdogLines(),
      fetchInjuryMap(),
      fetchAllESPNGames(),
    ])

    // Merge: PP is primary source of truth; Underdog adds any lines PP missed
    const ppLines = ppResult.status === 'fulfilled' ? ppResult.value : []
    const udLines = udResult.status === 'fulfilled' ? udResult.value : []

    if (ppLines.length > 0) {
      console.log(`[scheduler] PrizePicks: ${ppLines.length} lines`)
    } else {
      console.warn('[scheduler] PrizePicks unavailable — using Underdog only')
    }

    // Deduplicate: use PP line if same player+stat exists in both, else keep all
    const ppKey = l => `${l.playerName.toLowerCase()}|${l.statType.toLowerCase()}`
    const ppKeys = new Set(ppLines.map(ppKey))
    const udUnique = udLines.filter(l => !ppKeys.has(ppKey(l)))
    const rawLines = [...ppLines, ...udUnique]

    console.log(`[scheduler] Combined: ${rawLines.length} lines (PP: ${ppLines.length}, UD-only: ${udUnique.length})`)

    if (espnGames.status === 'fulfilled') {
      setESPNGames(espnGames.value)
    }

    const mergedInjuries = injuries.status === 'fulfilled' ? injuries.value : {}

    setInjuryMap(mergedInjuries)
    setLastRefresh('injuries')

    const enriched = await enrichLines(rawLines)

    // Detect line movements since last snapshot
    detectLineMovements(enriched)

    setLiveLines(enriched)
    setLastRefresh('lines')

    // Regenerate daily slip after every line refresh
    generateDailySlip()

    // Push real-time update to all connected SSE clients
    pushSSE({ type: 'lines', count: enriched.length, ts: Date.now() })

    const elapsed = Date.now() - start
    console.log(`[scheduler] Refresh complete — ${enriched.length} lines in ${elapsed}ms (${sseClients.size} SSE clients notified)`)
  } catch (err) {
    console.error('[scheduler] Refresh failed:', err.message)
  } finally {
    isRefreshing = false
  }
}

export async function refreshNBAStats() {
  try {
    console.log('[scheduler] Refreshing NBA player map...')
    const map = await fetchNBAPlayerMap()
    setNBAPlayerMap(map)
    setLastRefresh('nbaStats')
    console.log(`[scheduler] NBA player map updated — ${Object.keys(map).length} players`)
  } catch (err) {
    console.error('[scheduler] NBA stats refresh failed:', err.message)
  }
}

export async function refreshInjuries() {
  try {
    const injuries = await fetchInjuryMap()
    setInjuryMap(injuries)
    setLastRefresh('injuries')

    // Re-enrich existing lines with updated injury data
    const { getLiveLines } = await import('../store.js')
    const current = getLiveLines()
    if (current.length > 0) {
      const re = await enrichLines(current.map(l => ({
        id: l.id,
        ppPlayerId: l.ppPlayerId,
        playerName: l.playerName,
        team: l.team,
        position: l.position,
        imageUrl: l.imageUrl,
        statType: l.statType,
        line: l.line,
        startTime: l.startTime,
        sport: l.sport,
        isPromo: l.isPromo,
        fetchedAt: l.fetchedAt,
      })))
      setLiveLines(re)
    }
    console.log('[scheduler] Injury re-check complete')
  } catch (err) {
    console.error('[scheduler] Injury refresh failed:', err.message)
  }
}

// ── Start all scheduled jobs ──────────────────────────────────────────────────
export function startScheduler() {
  // Full line refresh every 2 minutes — Underdog has no rate limit, PP uses internal cache
  cron.schedule('*/2 * * * *', () => {
    runFullRefresh()
  })

  // Injury refresh every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    refreshInjuries()
  })

  // NBA player map refresh every hour
  cron.schedule('0 * * * *', () => {
    refreshNBAStats()
  })

  // Auto-settle pending picks every hour
  cron.schedule('5 * * * *', () => {
    settlePendingPicks()
  })

  // Daily slip fresh generation at 8am
  cron.schedule('0 8 * * *', () => {
    generateDailySlip()
  })

  console.log('[scheduler] Scheduled jobs started (2min refresh, SSE push enabled)')
}

// ── Line movement detection ───────────────────────────────────────────────────
export function detectLineMovements(newLines) {
  const moved = []

  newLines.forEach(line => {
    const prev = previousLineSnapshot[line.id]
    if (prev != null && prev !== line.line) {
      const delta = line.line - prev
      moved.push({
        id: line.id,
        playerName: line.playerName,
        statType: line.statType,
        sport: line.sport,
        from: prev,
        to: line.line,
        delta: parseFloat(delta.toFixed(1)),
        direction: delta > 0 ? 'up' : 'down',
      })
    }
    previousLineSnapshot[line.id] = line.line
  })

  if (moved.length > 0) {
    console.log(`[scheduler] ${moved.length} line movements detected`)
    import('../store.js').then(({ setLineMovementAlerts }) => {
      if (setLineMovementAlerts) setLineMovementAlerts(moved)
    }).catch(() => {})
    // Push movement alert to all SSE clients immediately
    pushSSE({ type: 'movements', count: moved.length, ts: Date.now() })
  }

  return moved
}
