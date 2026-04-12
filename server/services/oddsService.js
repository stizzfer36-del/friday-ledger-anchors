// Odds / Game Total Service
// Provides implied game total for pace adjustment.
// Tries ESPN odds data; falls back to team-pace-based estimation.

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports'

// League average totals (2024-25 season)
const LEAGUE_AVERAGES = { NBA: 226, NFL: 47, MLB: 9.0, NHL: 5.8 }

// Per-team offensive pace proxies (relative to league avg, +/- points per game)
const NBA_TEAM_PACE = {
  SAC: +8, DEN: +6, ATL: +6, DAL: +5, MEM: +4, NYK: +4, MIL: +3,
  LAL: +2, PHX: +2, OKC: +1, GSW: +1, LAC: 0, BOS: -1, CLE: -2,
  MIA: -2, MIN: -3, PHI: -3, IND: +5, HOU: +3, ORL: -1,
}

const NFL_TEAM_PACE = {
  SF: +6, KC: +5, BUF: +4, BAL: +4, MIA: +4, PHI: +3,
  DAL: +2, LAR: +2, CIN: +1, DET: +1, HOU: +1, GB: 0,
  NYJ: -3, NE: -3, CHI: -2, CLE: -2,
}

// In-memory cache
const totalsCache = {}
const cacheTimestamps = {}
const CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour

/**
 * Get implied game total for a specific matchup.
 * @param {string} teamAbbr
 * @param {string} opponentAbbr
 * @param {string} sport
 * @returns {{ total: number, adjustment: number, multiplier: number, label: string|null }}
 */
export async function getGameTotalAdjustment(teamAbbr, opponentAbbr, sport) {
  const cacheKey = `${sport}:${teamAbbr}:${opponentAbbr}`
  const now = Date.now()
  if (totalsCache[cacheKey] && (now - (cacheTimestamps[cacheKey] || 0)) < CACHE_TTL_MS) {
    return totalsCache[cacheKey]
  }

  // Try ESPN odds
  try {
    const liveTotal = await fetchESPNTotal(teamAbbr, opponentAbbr, sport)
    if (liveTotal != null) {
      const result = computeAdjustment(liveTotal, sport)
      totalsCache[cacheKey] = result
      cacheTimestamps[cacheKey] = now
      return result
    }
  } catch (_) {}

  // Fall back to pace estimation
  const estimated = estimateTotal(teamAbbr, opponentAbbr, sport)
  const result = computeAdjustment(estimated, sport)
  totalsCache[cacheKey] = result
  cacheTimestamps[cacheKey] = now
  return result
}

async function fetchESPNTotal(teamAbbr, opponentAbbr, sport) {
  const paths = {
    NBA: 'basketball/nba', NFL: 'football/nfl',
    MLB: 'baseball/mlb',   NHL: 'hockey/nhl',
  }
  const path = paths[sport]
  if (!path) return null

  const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const url = `${ESPN_BASE}/${path}/scoreboard?dates=${today}`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) return null
  const json = await res.json()

  for (const event of (json.events || [])) {
    const comps = event.competitions?.[0]
    const teams = comps?.competitors?.map(c => c.team?.abbreviation?.toUpperCase())
    if (!teams) continue
    const matchTeam = teamAbbr?.toUpperCase()
    const matchOpp  = opponentAbbr?.toUpperCase()
    if (teams.includes(matchTeam) || teams.includes(matchOpp)) {
      const odds = comps?.odds?.[0]
      if (odds?.overUnder) return parseFloat(odds.overUnder)
    }
  }
  return null
}

function estimateTotal(teamAbbr, opponentAbbr, sport) {
  const avgTotal = LEAGUE_AVERAGES[sport] || 0
  const paceMap = sport === 'NBA' ? NBA_TEAM_PACE : sport === 'NFL' ? NFL_TEAM_PACE : {}
  const teamPace = paceMap[teamAbbr?.toUpperCase()] || 0
  const oppPace  = paceMap[opponentAbbr?.toUpperCase()] || 0
  // Average of two teams' pace adjustments applied to league avg
  return avgTotal + (teamPace + oppPace) / 2
}

/**
 * Compute projection multiplier based on implied total vs league average.
 * NBA: 240+ → +6%, 210- → -6%; scaled linearly in between.
 */
function computeAdjustment(total, sport) {
  const avg = LEAGUE_AVERAGES[sport]
  if (!avg) return { total, adjustment: 0, multiplier: 1.0, label: null }

  const thresholds = {
    NBA: { high: 240, low: 212, maxAdj: 0.06 },
    NFL: { high: 52,  low: 40,  maxAdj: 0.05 },
    MLB: { high: 11,  low: 7.5, maxAdj: 0.05 },
    NHL: { high: 6.5, low: 4.8, maxAdj: 0.04 },
  }[sport] || { high: avg * 1.06, low: avg * 0.94, maxAdj: 0.05 }

  let adjustment
  if (total >= thresholds.high) {
    adjustment = thresholds.maxAdj
  } else if (total <= thresholds.low) {
    adjustment = -thresholds.maxAdj
  } else {
    // Linear interpolation between low and high
    const range = thresholds.high - thresholds.low
    const position = total - thresholds.low
    adjustment = ((position / range) - 0.5) * 2 * thresholds.maxAdj
  }

  const label = adjustment > 0.02
    ? `High total (${total.toFixed(0)})`
    : adjustment < -0.02
      ? `Low total (${total.toFixed(0)})`
      : null

  return {
    total: parseFloat(total.toFixed(1)),
    adjustment: parseFloat((adjustment * 100).toFixed(1)),
    multiplier: parseFloat((1 + adjustment).toFixed(4)),
    label,
  }
}
