// ESPN unofficial API — game schedules, live scores, player news
// No API key required. Refreshes supplementary data for EV enrichment.

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports'

const SPORT_PATHS = {
  NBA:  'basketball/nba',
  NFL:  'football/nfl',
  MLB:  'baseball/mlb',
  NHL:  'hockey/nhl',
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  'Accept': 'application/json',
}

// Fetch today's schedule/scores for a sport
export async function fetchESPNScoreboard(sport = 'NBA') {
  const path = SPORT_PATHS[sport]
  if (!path) return []

  const res = await fetch(`${ESPN_BASE}/${path}/scoreboard`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`ESPN ${sport} scoreboard HTTP ${res.status}`)
  const json = await res.json()

  return (json.events || []).map(event => {
    const comp = event.competitions?.[0] || {}
    const competitors = comp.competitors || []
    const home = competitors.find(c => c.homeAway === 'home')
    const away = competitors.find(c => c.homeAway === 'away')
    return {
      id: event.id,
      name: event.name,
      startTime: event.date,
      status: event.status?.type?.description || 'Scheduled',
      statusState: event.status?.type?.state || 'pre',
      homeTeam: home?.team?.abbreviation || '',
      awayTeam: away?.team?.abbreviation || '',
      homeScore: home?.score || '0',
      awayScore: away?.score || '0',
      sport,
    }
  })
}

// Fetch scoreboard for all sports and return a lookup map: "TEAM" → game info
export async function fetchAllESPNGames() {
  const results = await Promise.allSettled(
    Object.keys(SPORT_PATHS).map(s => fetchESPNScoreboard(s))
  )

  const gamesByTeam = {}
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') {
      console.warn(`[ESPN] ${Object.keys(SPORT_PATHS)[i]} failed: ${r.reason?.message}`)
      return
    }
    for (const game of r.value) {
      gamesByTeam[game.homeTeam] = game
      gamesByTeam[game.awayTeam] = game
    }
  })

  const total = Object.keys(gamesByTeam).length
  console.log(`[ESPN] ${total} team-game entries loaded`)
  return gamesByTeam
}

// Fetch ESPN injuries (as backup to RotoWire)
export async function fetchESPNInjuries(sport = 'NBA') {
  const path = SPORT_PATHS[sport]
  if (!path) return []

  try {
    const res = await fetch(`${ESPN_BASE}/${path}/injuries`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = await res.json()
    const injuries = []
    for (const team of (json.injuries || [])) {
      for (const injury of (team.injuries || [])) {
        injuries.push({
          playerName: injury.athlete?.fullName || '',
          team: team.team?.abbreviation || '',
          status: injury.status || 'Questionable',
          detail: injury.details?.fantasyStatus?.description || injury.type?.description || '',
          sport,
        })
      }
    }
    return injuries
  } catch {
    return []
  }
}
