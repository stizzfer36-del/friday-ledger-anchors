// Daily Slip Service
// Generates and caches the "slip of the day" every morning at 8am.
// This is the centerpiece of the picks feed — what replaces a Discord capper's daily post.

import { getLiveLines } from '../store.js'
import { buildOptimalSlip } from './autoSlip.js'

let dailySlipCache = {
  generatedAt: null,
  power5: null,
  power3: null,
  flex5: null,
  topPicks: [],  // top 8 individual picks
}

const DAILY_CACHE_TTL_MS = 4 * 60 * 60 * 1000  // 4 hours

/**
 * Returns the daily slip of the day.
 * Regenerates if cache is stale (> 4 hours) or forced.
 */
export function getDailySlip(force = false) {
  const age = dailySlipCache.generatedAt
    ? Date.now() - new Date(dailySlipCache.generatedAt).getTime()
    : Infinity

  if (!force && dailySlipCache.power5 && age < DAILY_CACHE_TTL_MS) {
    return dailySlipCache
  }

  return generateDailySlip()
}

export function generateDailySlip() {
  const lines = getLiveLines()
  if (!lines.length) return dailySlipCache

  const eligibleLines = lines.filter(l =>
    l.recommendation !== 'SKIP' &&
    l.confidence !== 'INVALID' &&
    l.injury?.status !== 'out' &&
    l.injury?.status !== 'doubtful' &&
    l.minutesToGame > 15
  )

  // Generate 3 slip formats
  const power5 = buildOptimalSlip(eligibleLines, { pickCount: 5, playType: 'power', minEV: 1 })
  const power3 = buildOptimalSlip(eligibleLines, { pickCount: 3, playType: 'power', minEV: 3 })
  const flex5  = buildOptimalSlip(eligibleLines, { pickCount: 5, playType: 'flex',  minEV: 1 })

  // Top 8 picks individually (for the "daily picks feed")
  const topPicks = eligibleLines
    .filter(l => l.evScore > 0)
    .slice(0, 8)
    .map(l => ({
      id: l.id,
      playerName: l.playerName,
      team: l.team,
      sport: l.sport,
      statType: l.statType,
      line: l.line,
      projection: l.adjustedProjection,
      hitRate: l.hitRate,
      evScore: l.evScore,
      recommendation: l.recommendation,
      pick: l.pick,
      trend: l.trend,
      trendDelta: l.trendDelta,
      injury: l.injury,
      reasoning: l.reasoning,
      minutesToGame: l.minutesToGame,
      calibration: l.calibration,
      isMockData: l.isMockData,
      shareSlug: buildShareSlug(l),
    }))

  dailySlipCache = {
    generatedAt: new Date().toISOString(),
    power5,
    power3,
    flex5,
    topPicks,
    meta: {
      totalLines: lines.length,
      strongCount: lines.filter(l => l.recommendation === 'STRONG').length,
      goodCount: lines.filter(l => l.recommendation === 'GOOD').length,
    },
  }

  console.log(`[dailySlip] Generated — ${topPicks.length} top picks, power5 has ${power5.picks?.length || 0} picks`)
  return dailySlipCache
}

function buildShareSlug(line) {
  const sport = (line.sport || 'sport').toLowerCase()
  const player = line.playerName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  const stat = (line.statType || 'stat').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  const date = new Date().toISOString().split('T')[0]
  return `${sport}-${player}-${stat}-${date}`
}
