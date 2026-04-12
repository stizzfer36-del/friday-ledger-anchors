// Auto-settlement service
// Checks ESPN box scores for completed games and auto-settles pending picks.
// Runs on a cron schedule after game completion windows.

import { db } from '../models/db.js'
import { v4 as uuidv4 } from 'uuid'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports'
const SPORT_PATHS = {
  NBA: 'basketball/nba',
  NFL: 'football/nfl',
  MLB: 'baseball/mlb',
  NHL: 'hockey/nhl',
}

// Stat extractors from ESPN athlete stats
// Maps PrizePicks stat types → ESPN box score extractor
const ESPN_STAT_MAP = {
  NBA: {
    'Points':         s => s.PTS,
    'Rebounds':       s => s.REB,
    'Assists':        s => s.AST,
    'Blocked Shots':  s => s.BLK,
    'Steals':         s => s.STL,
    '3-PT Made':      s => s.FG3M,
    'Pts+Rebs+Asts':  s => s.PTS + s.REB + s.AST,
    'Pts+Rebs':       s => s.PTS + s.REB,
    'Pts+Asts':       s => s.PTS + s.AST,
    'Rebs+Asts':      s => s.REB + s.AST,
    'Blks+Stls':      s => s.BLK + s.STL,
  },
}

/**
 * Main entry point: settle all pending picks for all users.
 * Batches by sport + date to minimize ESPN API calls.
 */
export async function settlePendingPicks() {
  const pending = db.prepare(`
    SELECT * FROM user_picks
    WHERE result IS NULL
    AND loggedAt < datetime('now', '-3 hours')
    ORDER BY sport, loggedAt
  `).all()

  if (!pending.length) {
    console.log('[settlement] No pending picks to settle')
    return { settled: 0, skipped: 0 }
  }

  console.log(`[settlement] Checking ${pending.length} pending picks...`)

  // Group by sport
  const bySport = {}
  pending.forEach(p => {
    if (!bySport[p.sport]) bySport[p.sport] = []
    bySport[p.sport].push(p)
  })

  let totalSettled = 0
  let totalSkipped = 0

  for (const [sport, picks] of Object.entries(bySport)) {
    const path = SPORT_PATHS[sport]
    if (!path) { totalSkipped += picks.length; continue }

    // Get unique dates
    const dates = [...new Set(picks.map(p => p.loggedAt.split('T')[0]))]

    for (const dateStr of dates) {
      try {
        const boxScores = await fetchBoxScores(path, dateStr)
        const picksOnDate = picks.filter(p => p.loggedAt.startsWith(dateStr))
        const { settled, skipped } = settlePicksAgainstBoxScores(picksOnDate, boxScores, sport)
        totalSettled += settled
        totalSkipped += skipped
      } catch (err) {
        console.warn(`[settlement] Failed for ${sport} on ${dateStr}: ${err.message}`)
        totalSkipped += picks.filter(p => p.loggedAt.startsWith(dateStr)).length
      }
    }
  }

  console.log(`[settlement] Done: ${totalSettled} settled, ${totalSkipped} skipped`)
  return { settled: totalSettled, skipped: totalSkipped }
}

async function fetchBoxScores(sportPath, dateStr) {
  const dateFormatted = dateStr.replace(/-/g, '')
  const url = `${ESPN_BASE}/${sportPath}/scoreboard?dates=${dateFormatted}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()

  // Build map: playerName.toLowerCase() → { statType → value }
  const playerStats = {}

  for (const event of (json.events || [])) {
    const isComplete = event.status?.type?.completed
    if (!isComplete) continue

    for (const comp of (event.competitions || [])) {
      for (const competitor of (comp.competitors || [])) {
        const stats = competitor.statistics || []
        for (const stat of stats) {
          // ESPN statistics format varies by sport — normalize key names
          const normalized = normalizeESPNStats(stat)
          if (normalized.name) {
            playerStats[normalized.name.toLowerCase()] = normalized
          }
        }
      }
    }
  }

  return playerStats
}

function normalizeESPNStats(athleteStat) {
  // ESPN box score structure: athlete.statistics[].athlete.displayName + stats
  const name = athleteStat.athlete?.displayName || ''
  const stats = {}

  ;(athleteStat.stats || []).forEach((s, i) => {
    // Map common ESPN stat abbreviations
    const abbrs = (athleteStat.names || [])
    if (abbrs[i]) stats[abbrs[i]] = parseFloat(s) || 0
  })

  return { name, ...stats }
}

function settlePicksAgainstBoxScores(picks, boxScores, sport) {
  const statMap = ESPN_STAT_MAP[sport] || {}
  let settled = 0
  let skipped = 0

  for (const pick of picks) {
    const playerStats = boxScores[pick.playerName.toLowerCase()]
    if (!playerStats) { skipped++; continue }

    const extractor = statMap[pick.statType]
    if (!extractor) { skipped++; continue }

    let statValue
    try { statValue = extractor(playerStats) } catch { skipped++; continue }

    if (statValue == null || isNaN(statValue)) { skipped++; continue }

    const direction = pick.direction || 'OVER'
    const result = direction === 'OVER'
      ? (statValue > pick.line ? 'hit' : 'miss')
      : (statValue < pick.line ? 'hit' : 'miss')

    const now = new Date().toISOString()
    db.prepare(`
      UPDATE user_picks SET result = ?, settledAt = ? WHERE id = ?
    `).run(result, now, pick.id)

    // Auto-log bankroll entry
    if (pick.entryAmount > 0) {
      const type = result === 'hit' ? 'win' : 'loss'
      const amount = result === 'hit' ? pick.entryAmount * 2 : -pick.entryAmount
      db.prepare(`
        INSERT INTO user_bankroll (id, userId, type, amount, note, pickId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), pick.userId, type, amount,
        `Auto-settled: ${pick.playerName} ${pick.statType} ${result === 'hit' ? '✓' : '✗'} (actual: ${statValue.toFixed(1)} vs ${pick.line})`,
        pick.id, now
      )
    }

    settled++
  }

  return { settled, skipped }
}
