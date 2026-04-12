// PrizePicks line fetcher
// Tries the real PrizePicks projection API first; falls back to rich mock data

const PP_BASE = 'https://api.prizepicks.com'

const LEAGUE_IDS = { NBA: 7, NFL: 9, MLB: 2, NHL: 12, NCAAB: 3, NCAAF: 8 }
const ALL_LEAGUES = ['NBA', 'NFL', 'MLB', 'NHL']

export async function fetchPrizePicksLines(league = 'NBA') {
  const leagueId = LEAGUE_IDS[league] || 7
  const url = `${PP_BASE}/projections?per_page=250&league_id=${leagueId}&single_stat=true`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        'Accept': 'application/json',
        'Origin': 'https://prizepicks.com',
        'Referer': 'https://prizepicks.com/',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const parsed = parseProjections(json, league)
    if (parsed.length > 0) {
      console.log(`[PrizePicks] Fetched ${parsed.length} real lines for ${league}`)
      return parsed
    }
    throw new Error('Empty response')
  } catch (err) {
    console.warn(`[PrizePicks] ${league} API unavailable (${err.message}), using mock data`)
    return getMockLines(league)
  }
}

// Fetch all sports simultaneously and merge
export async function fetchAllLines() {
  const results = await Promise.allSettled(
    ALL_LEAGUES.map(league => fetchPrizePicksLines(league))
  )
  const all = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      all.push(...r.value)
    } else {
      console.warn(`[PrizePicks] ${ALL_LEAGUES[i]} fetch failed:`, r.reason?.message)
    }
  })
  console.log(`[PrizePicks] Total lines across all sports: ${all.length}`)
  return all
}

function parseProjections(json, league) {
  const { data = [], included = [] } = json

  const players = {}
  included.forEach(item => {
    if (item.type === 'new_player') players[item.id] = item.attributes
  })

  return data
    .filter(d => d.type === 'Projection' && d.attributes?.status === 'pre_game')
    .map(d => {
      const pid = d.relationships?.new_player?.data?.id
      const player = players[pid] || {}
      return {
        id: d.id,
        ppPlayerId: pid,
        playerName: player.name || d.attributes.description || 'Unknown',
        team: player.team || '',
        position: player.position || '',
        imageUrl: player.image_url || null,
        statType: d.attributes.stat_type,
        line: parseFloat(d.attributes.line_score),
        startTime: d.attributes.start_time,
        sport: league,
        isPromo: d.attributes.is_promo || false,
        fetchedAt: new Date().toISOString(),
      }
    })
    .filter(p => p.playerName && p.line > 0)
}

// ── Rich mock data (2024-25 season realistic lines) ──────────────────────────
function getMockLines(league) {
  const now = new Date()
  const t1 = new Date(now.getTime() + 4.5 * 3600000).toISOString()
  const t2 = new Date(now.getTime() + 6   * 3600000).toISOString()
  const t3 = new Date(now.getTime() + 7.5 * 3600000).toISOString()

  if (league === 'NBA') return buildLines(getNBAMock(t1, t2, t3), 'NBA')
  if (league === 'NFL') return buildLines(getNFLMock(t1, t2, t3), 'NFL')
  if (league === 'MLB') return buildLines(getMLBMock(t1, t2, t3), 'MLB')
  if (league === 'NHL') return buildLines(getNHLMock(t1, t2, t3), 'NHL')
  return []
}

function buildLines(raw, sport) {
  return raw.map((r, i) => ({
    id: `mock-${sport}-${i}-${r.name.replace(/[\s']/g, '')}-${r.stat}`,
    ppPlayerId: `mock-player-${sport}-${r.name.replace(/[\s']/g, '')}`,
    playerName: r.name,
    team: r.team,
    position: r.pos,
    imageUrl: null,
    statType: r.stat,
    line: r.line,
    startTime: r.start,
    sport,
    isPromo: false,
    fetchedAt: new Date().toISOString(),
    opponent: r.opp  || null,
    isHome:   r.home != null ? r.home : null,
    daysRest: r.rest != null ? r.rest : null,
  }))
}

function getNBAMock(t1, t2, t3) {
  return [
    // DAL (home, 2 days rest) vs GSW (away, B2B — 1 day rest)
    { name: 'Luka Doncic',            team: 'DAL', pos: 'PG', stat: 'Points',            line: 27.5, start: t1, opp: 'GSW', home: true,  rest: 2 },
    { name: 'Luka Doncic',            team: 'DAL', pos: 'PG', stat: 'Rebounds',           line: 8.5,  start: t1, opp: 'GSW', home: true,  rest: 2 },
    { name: 'Luka Doncic',            team: 'DAL', pos: 'PG', stat: 'Assists',             line: 7.5,  start: t1, opp: 'GSW', home: true,  rest: 2 },
    { name: 'Luka Doncic',            team: 'DAL', pos: 'PG', stat: 'Pts+Rebs+Asts',      line: 44.5, start: t1, opp: 'GSW', home: true,  rest: 2 },
    { name: 'Stephen Curry',           team: 'GSW', pos: 'PG', stat: 'Points',            line: 25.5, start: t1, opp: 'DAL', home: false, rest: 1 },
    { name: 'Stephen Curry',           team: 'GSW', pos: 'PG', stat: '3-PT Made',         line: 4.5,  start: t1, opp: 'DAL', home: false, rest: 1 },
    { name: 'Draymond Green',          team: 'GSW', pos: 'PF', stat: 'Assists',            line: 6.5,  start: t1, opp: 'DAL', home: false, rest: 1 },
    // DEN (home, 3 days rest) vs LAL (away, 2 days rest)
    { name: 'Nikola Jokic',            team: 'DEN', pos: 'C',  stat: 'Pts+Rebs+Asts',     line: 53.5, start: t2, opp: 'LAL', home: true,  rest: 3 },
    { name: 'Nikola Jokic',            team: 'DEN', pos: 'C',  stat: 'Points',             line: 28.5, start: t2, opp: 'LAL', home: true,  rest: 3 },
    { name: 'Nikola Jokic',            team: 'DEN', pos: 'C',  stat: 'Rebounds',           line: 12.5, start: t2, opp: 'LAL', home: true,  rest: 3 },
    { name: 'Jamal Murray',            team: 'DEN', pos: 'PG', stat: 'Points',             line: 19.5, start: t2, opp: 'LAL', home: true,  rest: 3 },
    { name: 'LeBron James',            team: 'LAL', pos: 'SF', stat: 'Points',             line: 22.5, start: t2, opp: 'DEN', home: false, rest: 2 },
    { name: 'LeBron James',            team: 'LAL', pos: 'SF', stat: 'Pts+Rebs+Asts',      line: 42.5, start: t2, opp: 'DEN', home: false, rest: 2 },
    { name: 'Anthony Davis',           team: 'LAL', pos: 'C',  stat: 'Points',             line: 26.5, start: t2, opp: 'DEN', home: false, rest: 2 },
    { name: 'Anthony Davis',           team: 'LAL', pos: 'C',  stat: 'Rebounds',           line: 11.5, start: t2, opp: 'DEN', home: false, rest: 2 },
    // BOS (home, 3 days rest) vs MIL (away, B2B — 1 day rest)
    { name: 'Jayson Tatum',            team: 'BOS', pos: 'SF', stat: 'Points',             line: 27.5, start: t3, opp: 'MIL', home: true,  rest: 3 },
    { name: 'Jayson Tatum',            team: 'BOS', pos: 'SF', stat: 'Pts+Rebs+Asts',      line: 41.5, start: t3, opp: 'MIL', home: true,  rest: 3 },
    { name: 'Jaylen Brown',            team: 'BOS', pos: 'SG', stat: 'Points',             line: 23.5, start: t3, opp: 'MIL', home: true,  rest: 3 },
    { name: 'Giannis Antetokounmpo',   team: 'MIL', pos: 'PF', stat: 'Points',            line: 30.5, start: t3, opp: 'BOS', home: false, rest: 1 },
    { name: 'Giannis Antetokounmpo',   team: 'MIL', pos: 'PF', stat: 'Rebounds',           line: 11.5, start: t3, opp: 'BOS', home: false, rest: 1 },
    { name: 'Giannis Antetokounmpo',   team: 'MIL', pos: 'PF', stat: 'Pts+Rebs+Asts',      line: 52.5, start: t3, opp: 'BOS', home: false, rest: 1 },
    // OKC (home, 2 days rest) vs PHX (away, 2 days rest)
    { name: 'Shai Gilgeous-Alexander', team: 'OKC', pos: 'SG', stat: 'Points',            line: 30.5, start: t1, opp: 'PHX', home: true,  rest: 2 },
    { name: 'Shai Gilgeous-Alexander', team: 'OKC', pos: 'SG', stat: 'Pts+Rebs+Asts',     line: 43.5, start: t1, opp: 'PHX', home: true,  rest: 2 },
    { name: 'Kevin Durant',            team: 'PHX', pos: 'SF', stat: 'Points',             line: 26.5, start: t1, opp: 'OKC', home: false, rest: 2 },
    { name: 'Devin Booker',            team: 'PHX', pos: 'SG', stat: 'Points',             line: 25.5, start: t1, opp: 'OKC', home: false, rest: 2 },
    // ATL (away, B2B — 1 day rest) vs SAC (home, 3 days rest)
    { name: 'Trae Young',              team: 'ATL', pos: 'PG', stat: 'Points',             line: 24.5, start: t2, opp: 'SAC', home: false, rest: 1 },
    { name: 'Trae Young',              team: 'ATL', pos: 'PG', stat: 'Assists',             line: 9.5,  start: t2, opp: 'SAC', home: false, rest: 1 },
    { name: "De'Aaron Fox",            team: 'SAC', pos: 'PG', stat: 'Points',             line: 24.5, start: t2, opp: 'ATL', home: true,  rest: 3 },
    // PHI (home, 2 days rest) vs CLE (away, 3 days rest)
    { name: 'Donovan Mitchell',        team: 'CLE', pos: 'SG', stat: 'Points',             line: 26.5, start: t3, opp: 'PHI', home: false, rest: 3 },
    { name: 'Joel Embiid',             team: 'PHI', pos: 'C',  stat: 'Points',             line: 33.5, start: t3, opp: 'CLE', home: true,  rest: 2 },
    { name: 'Joel Embiid',             team: 'PHI', pos: 'C',  stat: 'Rebounds',           line: 10.5, start: t3, opp: 'CLE', home: true,  rest: 2 },
    // MEM (away, 2 days rest) vs NYK (home, 3 days rest)
    { name: 'Ja Morant',               team: 'MEM', pos: 'PG', stat: 'Points',             line: 23.5, start: t2, opp: 'NYK', home: false, rest: 2 },
    { name: 'Jalen Brunson',           team: 'NYK', pos: 'PG', stat: 'Points',             line: 27.5, start: t2, opp: 'MEM', home: true,  rest: 3 },
    { name: 'Karl-Anthony Towns',      team: 'NYK', pos: 'C',  stat: 'Points',             line: 22.5, start: t2, opp: 'MEM', home: true,  rest: 3 },
  ]
}

function getNFLMock(t1, t2, t3) {
  return [
    // KC (home, 7 days rest) vs BUF (away, 7 days rest)
    { name: 'Patrick Mahomes',   team: 'KC',  pos: 'QB', stat: 'Passing Yards',   line: 285.5, start: t1, opp: 'BUF', home: true,  rest: 7 },
    { name: 'Patrick Mahomes',   team: 'KC',  pos: 'QB', stat: 'Passing TDs',     line: 2.5,   start: t1, opp: 'BUF', home: true,  rest: 7 },
    { name: 'Patrick Mahomes',   team: 'KC',  pos: 'QB', stat: 'Pass Attempts',   line: 34.5,  start: t1, opp: 'BUF', home: true,  rest: 7 },
    { name: 'Travis Kelce',      team: 'KC',  pos: 'TE', stat: 'Receiving Yards', line: 62.5,  start: t1, opp: 'BUF', home: true,  rest: 7 },
    { name: 'Travis Kelce',      team: 'KC',  pos: 'TE', stat: 'Receptions',      line: 5.5,   start: t1, opp: 'BUF', home: true,  rest: 7 },
    { name: 'Josh Allen',        team: 'BUF', pos: 'QB', stat: 'Passing Yards',   line: 275.5, start: t1, opp: 'KC',  home: false, rest: 7 },
    { name: 'Josh Allen',        team: 'BUF', pos: 'QB', stat: 'Passing TDs',     line: 2.5,   start: t1, opp: 'KC',  home: false, rest: 7 },
    { name: 'Josh Allen',        team: 'BUF', pos: 'QB', stat: 'Rushing Yards',   line: 38.5,  start: t1, opp: 'KC',  home: false, rest: 7 },
    { name: 'Stefon Diggs',      team: 'BUF', pos: 'WR', stat: 'Receiving Yards', line: 68.5,  start: t1, opp: 'KC',  home: false, rest: 7 },
    // SF (home, 7 days) vs DAL (away, 7 days)
    { name: 'Christian McCaffrey', team: 'SF',  pos: 'RB', stat: 'Rushing Yards',   line: 82.5, start: t2, opp: 'DAL', home: true,  rest: 7 },
    { name: 'Christian McCaffrey', team: 'SF',  pos: 'RB', stat: 'Receptions',       line: 5.5,  start: t2, opp: 'DAL', home: true,  rest: 7 },
    { name: 'Christian McCaffrey', team: 'SF',  pos: 'RB', stat: 'Receiving Yards',  line: 44.5, start: t2, opp: 'DAL', home: true,  rest: 7 },
    { name: 'Tyreek Hill',         team: 'MIA', pos: 'WR', stat: 'Receiving Yards',  line: 82.5, start: t2, opp: 'NE',  home: true,  rest: 7 },
    { name: 'Tyreek Hill',         team: 'MIA', pos: 'WR', stat: 'Receptions',        line: 6.5,  start: t2, opp: 'NE',  home: true,  rest: 7 },
    { name: 'CeeDee Lamb',         team: 'DAL', pos: 'WR', stat: 'Receiving Yards',  line: 88.5, start: t2, opp: 'SF',  home: false, rest: 7 },
    { name: 'CeeDee Lamb',         team: 'DAL', pos: 'WR', stat: 'Receptions',        line: 6.5,  start: t2, opp: 'SF',  home: false, rest: 7 },
    // BAL (home, 7 days) vs PHI (away, 7 days)
    { name: 'Lamar Jackson',      team: 'BAL', pos: 'QB', stat: 'Passing Yards',   line: 245.5, start: t3, opp: 'PHI', home: true,  rest: 7 },
    { name: 'Lamar Jackson',      team: 'BAL', pos: 'QB', stat: 'Rushing Yards',   line: 62.5,  start: t3, opp: 'PHI', home: true,  rest: 7 },
    { name: 'Lamar Jackson',      team: 'BAL', pos: 'QB', stat: 'Passing TDs',     line: 2.5,   start: t3, opp: 'PHI', home: true,  rest: 7 },
    { name: 'Derrick Henry',      team: 'BAL', pos: 'RB', stat: 'Rushing Yards',   line: 88.5,  start: t3, opp: 'PHI', home: true,  rest: 7 },
    { name: 'Derrick Henry',      team: 'BAL', pos: 'RB', stat: 'Receptions',      line: 2.5,   start: t3, opp: 'PHI', home: true,  rest: 7 },
    { name: 'Jalen Hurts',        team: 'PHI', pos: 'QB', stat: 'Passing Yards',   line: 248.5, start: t3, opp: 'BAL', home: false, rest: 7 },
    { name: 'Jalen Hurts',        team: 'PHI', pos: 'QB', stat: 'Rushing Yards',   line: 52.5,  start: t3, opp: 'BAL', home: false, rest: 7 },
    { name: "A.J. Brown",         team: 'PHI', pos: 'WR', stat: 'Receiving Yards', line: 78.5,  start: t3, opp: 'BAL', home: false, rest: 7 },
  ]
}

function getMLBMock(t1, t2, t3) {
  return [
    // LAD (home, 1 day rest) vs NYY (away, 2 days rest)
    { name: 'Shohei Ohtani',     team: 'LAD', pos: 'DH',  stat: 'Hits',              line: 1.5, start: t1, opp: 'NYY', home: true,  rest: 1 },
    { name: 'Shohei Ohtani',     team: 'LAD', pos: 'DH',  stat: 'Total Bases',       line: 2.5, start: t1, opp: 'NYY', home: true,  rest: 1 },
    { name: 'Shohei Ohtani',     team: 'LAD', pos: 'DH',  stat: 'Runs Scored',       line: 0.5, start: t1, opp: 'NYY', home: true,  rest: 1 },
    { name: 'Freddie Freeman',   team: 'LAD', pos: '1B',  stat: 'Hits',              line: 1.5, start: t1, opp: 'NYY', home: true,  rest: 1 },
    { name: 'Freddie Freeman',   team: 'LAD', pos: '1B',  stat: 'Total Bases',       line: 2.5, start: t1, opp: 'NYY', home: true,  rest: 1 },
    { name: 'Aaron Judge',       team: 'NYY', pos: 'RF',  stat: 'Hits',              line: 1.5, start: t1, opp: 'LAD', home: false, rest: 2 },
    { name: 'Aaron Judge',       team: 'NYY', pos: 'RF',  stat: 'Total Bases',       line: 2.5, start: t1, opp: 'LAD', home: false, rest: 2 },
    { name: 'Aaron Judge',       team: 'NYY', pos: 'RF',  stat: 'Home Runs',         line: 0.5, start: t1, opp: 'LAD', home: false, rest: 2 },
    { name: 'Juan Soto',         team: 'NYY', pos: 'LF',  stat: 'Hits',              line: 1.5, start: t1, opp: 'LAD', home: false, rest: 2 },
    { name: 'Juan Soto',         team: 'NYY', pos: 'LF',  stat: 'Walks',             line: 1.5, start: t1, opp: 'LAD', home: false, rest: 2 },
    // ATL (home, 2 days rest) vs HOU (away, 1 day rest)
    { name: 'Gerrit Cole',       team: 'NYY', pos: 'SP',  stat: 'Strikeouts',        line: 7.5,  start: t2, opp: 'LAD', home: false, rest: 4 },
    { name: 'Gerrit Cole',       team: 'NYY', pos: 'SP',  stat: 'Pitcher Outs',      line: 16.5, start: t2, opp: 'LAD', home: false, rest: 4 },
    { name: 'Spencer Strider',   team: 'ATL', pos: 'SP',  stat: 'Strikeouts',        line: 8.5,  start: t2, opp: 'HOU', home: true,  rest: 4 },
    { name: 'Spencer Strider',   team: 'ATL', pos: 'SP',  stat: 'Pitcher Outs',      line: 17.5, start: t2, opp: 'HOU', home: true,  rest: 4 },
    { name: 'Ronald Acuna Jr.',  team: 'ATL', pos: 'RF',  stat: 'Hits',              line: 1.5,  start: t2, opp: 'HOU', home: true,  rest: 2 },
    { name: 'Ronald Acuna Jr.',  team: 'ATL', pos: 'RF',  stat: 'Stolen Bases',      line: 0.5,  start: t2, opp: 'HOU', home: true,  rest: 2 },
    { name: 'Yordan Alvarez',    team: 'HOU', pos: 'DH',  stat: 'Hits',              line: 1.5,  start: t2, opp: 'ATL', home: false, rest: 1 },
    { name: 'Yordan Alvarez',    team: 'HOU', pos: 'DH',  stat: 'Total Bases',       line: 2.5,  start: t2, opp: 'ATL', home: false, rest: 1 },
    // NYM (home, 2 days rest) vs PHI (away, 2 days rest)
    { name: 'Francisco Lindor',  team: 'NYM', pos: 'SS',  stat: 'Hits',              line: 1.5,  start: t3, opp: 'PHI', home: true,  rest: 2 },
    { name: 'Francisco Lindor',  team: 'NYM', pos: 'SS',  stat: 'Total Bases',       line: 2.5,  start: t3, opp: 'PHI', home: true,  rest: 2 },
    { name: 'Bryce Harper',      team: 'PHI', pos: '1B',  stat: 'Hits',              line: 1.5,  start: t3, opp: 'NYM', home: false, rest: 2 },
    { name: 'Bryce Harper',      team: 'PHI', pos: '1B',  stat: 'Total Bases',       line: 2.5,  start: t3, opp: 'NYM', home: false, rest: 2 },
  ]
}

function getNHLMock(t1, t2, t3) {
  return [
    // EDM vs COL
    { name: 'Connor McDavid',    team: 'EDM', pos: 'C',  stat: 'Points',            line: 1.5, start: t1 },
    { name: 'Connor McDavid',    team: 'EDM', pos: 'C',  stat: 'Shots on Goal',     line: 3.5, start: t1 },
    { name: 'Connor McDavid',    team: 'EDM', pos: 'C',  stat: 'Assists',           line: 0.5, start: t1 },
    { name: 'Leon Draisaitl',    team: 'EDM', pos: 'C',  stat: 'Points',            line: 1.5, start: t1 },
    { name: 'Leon Draisaitl',    team: 'EDM', pos: 'C',  stat: 'Shots on Goal',     line: 3.5, start: t1 },
    { name: 'Nathan MacKinnon',  team: 'COL', pos: 'C',  stat: 'Points',            line: 1.5, start: t1 },
    { name: 'Nathan MacKinnon',  team: 'COL', pos: 'C',  stat: 'Shots on Goal',     line: 3.5, start: t1 },
    // TOR vs BOS
    { name: 'Auston Matthews',   team: 'TOR', pos: 'C',  stat: 'Goals',             line: 0.5, start: t2 },
    { name: 'Auston Matthews',   team: 'TOR', pos: 'C',  stat: 'Shots on Goal',     line: 4.5, start: t2 },
    { name: 'Auston Matthews',   team: 'TOR', pos: 'C',  stat: 'Points',            line: 1.5, start: t2 },
    { name: 'William Nylander',  team: 'TOR', pos: 'RW', stat: 'Points',            line: 0.5, start: t2 },
    { name: 'David Pastrnak',    team: 'BOS', pos: 'RW', stat: 'Goals',             line: 0.5, start: t2 },
    { name: 'David Pastrnak',    team: 'BOS', pos: 'RW', stat: 'Shots on Goal',     line: 3.5, start: t2 },
    // NYR vs PIT
    { name: 'Artemi Panarin',    team: 'NYR', pos: 'LW', stat: 'Points',            line: 1.5, start: t3 },
    { name: 'Artemi Panarin',    team: 'NYR', pos: 'LW', stat: 'Shots on Goal',     line: 2.5, start: t3 },
    { name: 'Igor Shesterkin',   team: 'NYR', pos: 'G',  stat: 'Saves',             line: 27.5, start: t3 },
    { name: 'Evgeni Malkin',     team: 'PIT', pos: 'C',  stat: 'Points',            line: 0.5, start: t3 },
    { name: 'Evgeni Malkin',     team: 'PIT', pos: 'C',  stat: 'Shots on Goal',     line: 2.5, start: t3 },
  ]
}
