// Background job scheduler
// Keeps lines, injuries, and NBA stats fresh automatically

import cron from 'node-cron'
import { fetchAllLines } from './prizepicks.js'
import { fetchNBAPlayerMap } from './nbaStats.js'
import { fetchInjuryMap } from './espnInjuries.js'
import { enrichLines } from './evEngine.js'
import {
  setLiveLines,
  setNBAPlayerMap,
  setInjuryMap,
  setLastRefresh,
} from '../store.js'

let isRefreshing = false

// ── Full refresh pipeline ─────────────────────────────────────────────────────
export async function runFullRefresh() {
  if (isRefreshing) return
  isRefreshing = true
  const start = Date.now()

  try {
    console.log('[scheduler] Starting full refresh...')

    const [rawLines, injuries] = await Promise.all([
      fetchAllLines(),
      fetchInjuryMap(),
    ])

    setInjuryMap(injuries)
    setLastRefresh('injuries')

    const enriched = await enrichLines(rawLines)
    setLiveLines(enriched)
    setLastRefresh('lines')

    const elapsed = Date.now() - start
    console.log(`[scheduler] Refresh complete — ${enriched.length} lines in ${elapsed}ms`)
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
  // Full line refresh every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log('[scheduler] Cron: full refresh')
    runFullRefresh()
  })

  // Injury-only refresh every 8 minutes
  cron.schedule('*/8 * * * *', () => {
    console.log('[scheduler] Cron: injury check')
    refreshInjuries()
  })

  // NBA player map refresh every hour
  cron.schedule('0 * * * *', () => {
    console.log('[scheduler] Cron: NBA player map')
    refreshNBAStats()
  })

  console.log('[scheduler] Scheduled jobs started')
}
