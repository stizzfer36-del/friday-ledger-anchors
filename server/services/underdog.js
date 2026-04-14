// Underdog Fantasy live lines fetcher
// PrizePicks blocks server-side requests (HTTP 429); Underdog's public API works fine

const UD_URL = 'https://api.underdogfantasy.com/beta/v5/over_under_lines'
const SUPPORTED_SPORTS = new Set(['NBA', 'MLB', 'NHL', 'NFL', 'WNBA'])

// Normalize Underdog sport_id → our app's sport labels
const SPORT_MAP = {
  NBA: 'NBA', MLB: 'MLB', NHL: 'NHL', NFL: 'NFL', WNBA: 'NBA',
}

export async function fetchUnderdogLines() {
  const res = await fetch(UD_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(12000),
  })

  if (!res.ok) throw new Error(`Underdog API HTTP ${res.status}`)
  const json = await res.json()
  return parseUnderdogResponse(json)
}

function parseUnderdogResponse(json) {
  const { over_under_lines = [], appearances = [], players = [], games = [], solo_games = [] } = json

  // Build lookup maps
  const playerMap   = Object.fromEntries(players.map(p => [p.id, p]))
  const appearMap   = Object.fromEntries(appearances.map(a => [a.id, a]))

  // Build team_id → abbreviation from game titles ("MIA @ CHA" → away=MIA, home=CHA)
  const teamAbbr = {}
  for (const g of [...games, ...solo_games]) {
    const title = g.abbreviated_title || g.title || ''
    const parts = title.split('@').map(s => s.trim())
    if (parts.length === 2) {
      if (g.away_team_id) teamAbbr[g.away_team_id] = parts[0]
      if (g.home_team_id) teamAbbr[g.home_team_id] = parts[1]
    }
  }

  // Build match_id → game for start times
  const gameById = Object.fromEntries([...games, ...solo_games].map(g => [String(g.id), g]))

  const result = []

  for (const line of over_under_lines) {
    if (line.status !== 'active') continue

    const ou       = line.over_under || {}
    const appStat  = ou.appearance_stat || {}
    const app      = appearMap[appStat.appearance_id] || {}
    const player   = playerMap[app.player_id] || {}
    const sport    = player.sport_id || ''

    if (!SUPPORTED_SPORTS.has(sport)) continue

    const statValue = parseFloat(line.stat_value)
    if (!statValue || statValue <= 0) continue

    const playerName = [player.first_name, player.last_name].filter(Boolean).join(' ')
    if (!playerName) continue

    const game       = gameById[String(app.match_id)] || {}
    const teamId     = app.team_id || ''
    const teamAb     = teamAbbr[teamId] || player.position_name || ''
    const homeTeamId = game.home_team_id
    const isHome     = homeTeamId ? teamId === homeTeamId : null

    result.push({
      id:           line.id,
      udPlayerId:   player.id || null,
      playerName,
      team:         teamAb,
      position:     player.position_name || '',
      imageUrl:     player.image_url || player.dark_image_url || null,
      statType:     appStat.display_stat || ou.grid_display_title || '',
      line:         statValue,
      startTime:    game.scheduled_at || null,
      sport:        SPORT_MAP[sport] || sport,
      isHome,
      fetchedAt:    new Date().toISOString(),
      source:       'underdog',
    })
  }

  console.log(`[Underdog] Parsed ${result.length} active lines`)
  return result
}
