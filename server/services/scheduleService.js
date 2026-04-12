// Schedule Service
// Determines opponent and rest days for each team using ESPN scoreboard API.
// Falls back to mock schedule data when ESPN is unavailable.

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports'

const SPORT_PATHS = {
  NBA: 'basketball/nba',
  NFL: 'football/nfl',
  MLB: 'baseball/mlb',
  NHL: 'hockey/nhl',
}

// In-memory cache: { sport: { teamAbbr: { opponent, isHome, daysRest, gameDate } } }
const scheduleCache = {}
const cacheTimestamps = {}
const CACHE_TTL_MS = 30 * 60 * 1000  // 30 minutes

/**
 * Get schedule context for all teams in a sport.
 * Returns map: { teamAbbr: { opponent, isHome, daysRest } }
 */
export async function getScheduleContext(sport) {
  const now = Date.now()
  if (scheduleCache[sport] && (now - (cacheTimestamps[sport] || 0)) < CACHE_TTL_MS) {
    return scheduleCache[sport]
  }

  try {
    const result = await fetchESPNSchedule(sport)
    if (result && Object.keys(result).length > 0) {
      scheduleCache[sport] = result
      cacheTimestamps[sport] = now
      return result
    }
  } catch (err) {
    console.warn(`[scheduleService] ESPN fetch failed for ${sport}: ${err.message}`)
  }

  // Fall back to mock schedule
  const mock = getMockSchedule(sport)
  scheduleCache[sport] = mock
  cacheTimestamps[sport] = now
  return mock
}

async function fetchESPNSchedule(sport) {
  const path = SPORT_PATHS[sport]
  if (!path) return null

  const today = formatDate(new Date())
  const yesterday = formatDate(new Date(Date.now() - 86400000))
  const twoDaysAgo = formatDate(new Date(Date.now() - 2 * 86400000))

  // Fetch today's games (for opponent info) + last 2 days (for rest calc)
  const [todayRes, ydayRes, twoDayRes] = await Promise.allSettled([
    fetchScoreboard(path, today),
    fetchScoreboard(path, yesterday),
    fetchScoreboard(path, twoDaysAgo),
  ])

  const todayGames = todayRes.status === 'fulfilled' ? todayRes.value : []
  const ydayGames  = ydayRes.status === 'fulfilled'  ? ydayRes.value  : []
  const twoDayGames = twoDayRes.status === 'fulfilled' ? twoDayRes.value : []

  if (todayGames.length === 0) return null

  // Build team → last game date map
  const lastGameDate = {}
  ;[...twoDayGames, ...ydayGames].forEach(game => {
    game.teams?.forEach(team => {
      lastGameDate[team.abbr] = game.date
    })
  })

  const result = {}
  todayGames.forEach(game => {
    const [home, away] = game.teams || []
    if (!home || !away) return

    const homeDaysRest = calcDaysRest(lastGameDate[home.abbr], game.date)
    const awayDaysRest = calcDaysRest(lastGameDate[away.abbr], game.date)

    result[home.abbr] = { opponent: away.abbr, isHome: true,  daysRest: homeDaysRest }
    result[away.abbr] = { opponent: home.abbr, isHome: false, daysRest: awayDaysRest }
  })

  return result
}

async function fetchScoreboard(path, dateStr) {
  const url = `${ESPN_BASE}/${path}/scoreboard?dates=${dateStr}`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()

  return (json.events || []).map(event => ({
    date: event.date,
    teams: event.competitions?.[0]?.competitors?.map(c => ({
      abbr: c.team?.abbreviation,
      isHome: c.homeAway === 'home',
    })),
  }))
}

function calcDaysRest(lastGameDateStr, todayDateStr) {
  if (!lastGameDateStr) return 4  // no recent game found = well rested
  const last = new Date(lastGameDateStr).getTime()
  const today = new Date(todayDateStr).getTime()
  const diff = Math.round((today - last) / 86400000)
  return Math.max(1, diff)
}

function formatDate(d) {
  return d.toISOString().split('T')[0].replace(/-/g, '')
}

/**
 * Returns projection multiplier for rest days.
 * B2B (1 day): -12%, 2 days: -5%, 3+: 0%
 */
export function getRestAdjustment(daysRest) {
  if (daysRest == null || daysRest >= 3) return { multiplier: 1.0, penalty: 0, label: null }
  if (daysRest === 1) return { multiplier: 0.88, penalty: -12, label: 'B2B' }
  if (daysRest === 2) return { multiplier: 0.95, penalty: -5,  label: '2-day rest' }
  return { multiplier: 1.0, penalty: 0, label: null }
}

// ── Mock schedule fallback ────────────────────────────────────────────────────
function getMockSchedule(sport) {
  if (sport === 'NBA') {
    return {
      DAL: { opponent: 'GSW', isHome: true,  daysRest: 2 },
      GSW: { opponent: 'DAL', isHome: false, daysRest: 1 },  // B2B
      DEN: { opponent: 'LAL', isHome: true,  daysRest: 3 },
      LAL: { opponent: 'DEN', isHome: false, daysRest: 2 },
      BOS: { opponent: 'MIL', isHome: true,  daysRest: 3 },
      MIL: { opponent: 'BOS', isHome: false, daysRest: 1 },  // B2B
      OKC: { opponent: 'PHX', isHome: true,  daysRest: 2 },
      PHX: { opponent: 'OKC', isHome: false, daysRest: 2 },
      ATL: { opponent: 'SAC', isHome: false, daysRest: 1 },  // B2B
      SAC: { opponent: 'ATL', isHome: true,  daysRest: 3 },
      PHI: { opponent: 'CLE', isHome: true,  daysRest: 2 },
      CLE: { opponent: 'PHI', isHome: false, daysRest: 3 },
      MEM: { opponent: 'NYK', isHome: false, daysRest: 2 },
      NYK: { opponent: 'MEM', isHome: true,  daysRest: 3 },
    }
  }
  if (sport === 'NFL') {
    return {
      KC:  { opponent: 'BUF', isHome: true,  daysRest: 7 },
      BUF: { opponent: 'KC',  isHome: false, daysRest: 7 },
      SF:  { opponent: 'DAL', isHome: true,  daysRest: 7 },
      DAL: { opponent: 'SF',  isHome: false, daysRest: 7 },
      BAL: { opponent: 'PHI', isHome: true,  daysRest: 7 },
      PHI: { opponent: 'BAL', isHome: false, daysRest: 7 },
      MIA: { opponent: 'NE',  isHome: true,  daysRest: 7 },
    }
  }
  if (sport === 'MLB') {
    return {
      LAD: { opponent: 'NYY', isHome: true,  daysRest: 1 },
      NYY: { opponent: 'LAD', isHome: false, daysRest: 2 },
      ATL: { opponent: 'HOU', isHome: true,  daysRest: 2 },
      HOU: { opponent: 'ATL', isHome: false, daysRest: 1 },
      NYM: { opponent: 'PHI', isHome: true,  daysRest: 2 },
      PHI: { opponent: 'NYM', isHome: false, daysRest: 2 },
    }
  }
  if (sport === 'NHL') {
    return {
      EDM: { opponent: 'COL', isHome: true,  daysRest: 1 },  // B2B
      COL: { opponent: 'EDM', isHome: false, daysRest: 2 },
      TOR: { opponent: 'BOS', isHome: true,  daysRest: 2 },
      BOS: { opponent: 'TOR', isHome: false, daysRest: 1 },  // B2B
      NYR: { opponent: 'PIT', isHome: true,  daysRest: 3 },
      PIT: { opponent: 'NYR', isHome: false, daysRest: 2 },
    }
  }
  return {}
}
