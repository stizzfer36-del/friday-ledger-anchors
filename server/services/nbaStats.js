// NBA Stats API service
// Fetches player game logs and season averages for hit-rate calculation
// Also handles fallback game log generation for all sports

const NBA_BASE = 'https://stats.nba.com/stats'
const SEASON = '2024-25'

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://stats.nba.com',
  'Origin': 'https://stats.nba.com',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Connection': 'keep-alive',
}

async function nbaFetch(endpoint, params = {}) {
  const qs = new URLSearchParams({ ...params }).toString()
  const url = `${NBA_BASE}/${endpoint}?${qs}`
  const res = await fetch(url, {
    headers: NBA_HEADERS,
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`NBA API HTTP ${res.status}`)
  return res.json()
}

function parseResultSet(json, index = 0) {
  const rs = json.resultSets[index]
  return rs.rowSet.map(row =>
    Object.fromEntries(rs.headers.map((h, i) => [h, row[i]]))
  )
}

// ── Player ID lookup ──────────────────────────────────────────────────────────
export async function fetchNBAPlayerMap() {
  try {
    const json = await nbaFetch('commonallplayers', {
      LeagueID: '00',
      Season: SEASON,
      IsOnlyCurrentSeason: 1,
    })
    const players = parseResultSet(json)
    const map = {}
    players.forEach(p => {
      if (p.ROSTERSTATUS === 1 || p.GAMES_PLAYED_FLAG === 'Y') {
        map[p.DISPLAY_FIRST_LAST.toLowerCase()] = {
          nbaId: p.PERSON_ID,
          name: p.DISPLAY_FIRST_LAST,
          team: p.TEAM_ABBREVIATION || '',
        }
      }
    })
    console.log(`[nbaStats] Loaded ${Object.keys(map).length} player IDs`)
    return map
  } catch (err) {
    console.warn(`[nbaStats] Player map unavailable: ${err.message}`)
    return buildFallbackPlayerMap()
  }
}

// ── Game log fetch ─────────────────────────────────────────────────────────────
export async function fetchPlayerGameLog(nbaId, lastNGames = 20) {
  try {
    const json = await nbaFetch('playergamelog', {
      PlayerID: nbaId,
      Season: SEASON,
      SeasonType: 'Regular Season',
      LastNGames: lastNGames,
    })
    return parseResultSet(json).map(g => ({
      date: g.GAME_DATE,
      pts: g.PTS || 0,
      reb: g.REB || 0,
      ast: g.AST || 0,
      stl: g.STL || 0,
      blk: g.BLK || 0,
      fg3m: g.FG3M || 0,
      min: g.MIN || 0,
    }))
  } catch (err) {
    console.warn(`[nbaStats] Game log unavailable for ${nbaId}: ${err.message}`)
    return null
  }
}

// ── Stat type resolver ─────────────────────────────────────────────────────────
// Maps PrizePicks stat_type → function(gameRow) → number
export function getStatResolver(statType) {
  const map = {
    // NBA
    'Points':              g => g.pts,
    'Rebounds':            g => g.reb,
    'Assists':             g => g.ast,
    'Blocked Shots':       g => g.blk,
    'Steals':              g => g.stl,
    '3-PT Made':           g => g.fg3m,
    'Pts+Rebs+Asts':       g => g.pts + g.reb + g.ast,
    'Pts+Rebs':            g => g.pts + g.reb,
    'Pts+Asts':            g => g.pts + g.ast,
    'Rebs+Asts':           g => g.reb + g.ast,
    'Blks+Stls':           g => g.blk + g.stl,
    'Fantasy Points':      g => g.pts * 1 + g.reb * 1.2 + g.ast * 1.5 + g.blk * 3 + g.stl * 3,

    // NFL (uses generic `value` field from fallback log)
    'Passing Yards':       g => g.value ?? g.pts,
    'Passing TDs':         g => g.value ?? g.pts,
    'Pass Attempts':       g => g.value ?? g.pts,
    'Rushing Yards':       g => g.value ?? g.pts,
    'Rushing TDs':         g => g.value ?? g.pts,
    'Receiving Yards':     g => g.value ?? g.pts,
    'Receptions':          g => g.value ?? g.pts,
    'Receiving TDs':       g => g.value ?? g.pts,

    // MLB (batters)
    'Hits':                g => g.value ?? g.pts,
    'Total Bases':         g => g.value ?? g.pts,
    'Runs Scored':         g => g.value ?? g.pts,
    'RBIs':                g => g.value ?? g.pts,
    'Home Runs':           g => g.value ?? g.pts,
    'Walks':               g => g.value ?? g.pts,
    'Stolen Bases':        g => g.value ?? g.pts,
    // MLB (pitchers)
    'Strikeouts':          g => g.value ?? g.pts,
    'Pitcher Outs':        g => g.value ?? g.pts,
    'Earned Runs Allowed': g => g.value ?? g.pts,
    'Pitching Outs':       g => g.value ?? g.pts,

    // NHL
    'Goals':               g => g.value ?? g.pts,
    'Shots on Goal':       g => g.value ?? g.pts,
    'Saves':               g => g.value ?? g.pts,
    // 'Assists' already defined above — shared with NHL
    // 'Points' already defined above — shared with NHL
  }
  return map[statType] || null
}

// ── Fallback map (hardcoded 2024-25 active players) ──────────────────────────
function buildFallbackPlayerMap() {
  const players = [
    { id: 1629029, name: 'Luka Doncic',              team: 'DAL' },
    { id: 203507,  name: 'Giannis Antetokounmpo',    team: 'MIL' },
    { id: 201939,  name: 'Stephen Curry',             team: 'GSW' },
    { id: 2544,    name: 'LeBron James',              team: 'LAL' },
    { id: 201142,  name: 'Kevin Durant',              team: 'PHX' },
    { id: 1628369, name: 'Jayson Tatum',              team: 'BOS' },
    { id: 203999,  name: 'Nikola Jokic',              team: 'DEN' },
    { id: 203954,  name: 'Joel Embiid',               team: 'PHI' },
    { id: 1629630, name: 'Ja Morant',                 team: 'MEM' },
    { id: 1628378, name: 'Donovan Mitchell',          team: 'CLE' },
    { id: 1628386, name: "De'Aaron Fox",              team: 'SAC' },
    { id: 1629027, name: 'Trae Young',                team: 'ATL' },
    { id: 1629029, name: 'Shai Gilgeous-Alexander',  team: 'OKC' },
    { id: 203076,  name: 'Anthony Davis',             team: 'LAL' },
    { id: 1627759, name: 'Jaylen Brown',              team: 'BOS' },
    { id: 1628384, name: 'Jamal Murray',              team: 'DEN' },
    { id: 1629029, name: 'Devin Booker',              team: 'PHX' },
    { id: 203110,  name: 'Draymond Green',            team: 'GSW' },
    { id: 1629029, name: 'Jalen Brunson',             team: 'NYK' },
    { id: 1631094, name: 'Karl-Anthony Towns',        team: 'NYK' },
  ]

  const map = {}
  players.forEach(p => {
    map[p.name.toLowerCase()] = { nbaId: p.id, name: p.name, team: p.team }
  })
  return map
}

// ── Fallback game log generator (realistic variance around season avg) ─────────
// NOTE: All logs generated here are synthetic — based on hardcoded season averages
// with artificial variance. These are PRIOR estimates, not real game logs.
// Marked with _mock: true so the EV engine can cap confidence appropriately.
export function generateFallbackGameLog(playerName, statType, line) {
  const resolver = getStatResolver(statType)
  if (!resolver) return []

  const key = playerName.toLowerCase()
  const isNBAResolver = ['Points','Rebounds','Assists','Blocked Shots','Steals','3-PT Made',
    'Pts+Rebs+Asts','Pts+Rebs','Pts+Asts','Rebs+Asts','Blks+Stls','Fantasy Points'].includes(statType)

  if (isNBAResolver) {
    return generateNBALog(key, statType, line)
  }
  return generateGenericLog(key, statType, line)
}

function generateNBALog(key, statType, line) {
  const avgMap = {
    'luka doncic':              { pts: 27.5, reb: 8.1, ast: 7.9, stl: 1.4, blk: 0.5, fg3m: 3.2 },
    'giannis antetokounmpo':    { pts: 30.4, reb: 11.8, ast: 6.4, stl: 1.2, blk: 1.1, fg3m: 0.8 },
    'stephen curry':            { pts: 23.5, reb: 4.4, ast: 6.1, stl: 0.9, blk: 0.2, fg3m: 5.1 },
    'lebron james':             { pts: 23.7, reb: 9.0, ast: 9.0, stl: 1.0, blk: 0.6, fg3m: 1.5 },
    'kevin durant':             { pts: 26.6, reb: 6.3, ast: 4.5, stl: 0.9, blk: 1.3, fg3m: 2.1 },
    'jayson tatum':             { pts: 26.9, reb: 8.2, ast: 5.5, stl: 1.0, blk: 0.5, fg3m: 3.2 },
    'nikola jokic':             { pts: 29.6, reb: 12.7, ast: 10.0, stl: 1.4, blk: 0.9, fg3m: 1.1 },
    'joel embiid':              { pts: 34.7, reb: 11.0, ast: 5.6, stl: 1.1, blk: 1.7, fg3m: 1.2 },
    'ja morant':                { pts: 25.1, reb: 5.8, ast: 8.1, stl: 1.0, blk: 0.5, fg3m: 1.6 },
    'donovan mitchell':         { pts: 26.6, reb: 4.4, ast: 5.9, stl: 1.5, blk: 0.4, fg3m: 3.1 },
    "de'aaron fox":             { pts: 24.5, reb: 4.2, ast: 6.8, stl: 1.5, blk: 0.4, fg3m: 1.2 },
    'trae young':               { pts: 24.3, reb: 3.1, ast: 10.5, stl: 1.2, blk: 0.2, fg3m: 2.8 },
    'shai gilgeous-alexander':  { pts: 31.4, reb: 5.5, ast: 6.2, stl: 2.0, blk: 0.9, fg3m: 1.7 },
    'anthony davis':            { pts: 24.7, reb: 12.6, ast: 3.5, stl: 1.3, blk: 2.4, fg3m: 0.2 },
    'jaylen brown':             { pts: 22.2, reb: 5.3, ast: 3.6, stl: 1.0, blk: 0.5, fg3m: 2.8 },
    'jamal murray':             { pts: 20.5, reb: 4.4, ast: 6.5, stl: 1.0, blk: 0.4, fg3m: 2.4 },
    'devin booker':             { pts: 25.8, reb: 4.5, ast: 6.7, stl: 1.0, blk: 0.3, fg3m: 3.1 },
    'draymond green':           { pts: 8.1, reb: 7.1, ast: 7.0, stl: 1.0, blk: 0.9, fg3m: 0.8 },
    'jalen brunson':            { pts: 28.7, reb: 3.6, ast: 6.7, stl: 0.9, blk: 0.2, fg3m: 2.6 },
    'karl-anthony towns':       { pts: 24.0, reb: 13.2, ast: 3.1, stl: 0.8, blk: 1.1, fg3m: 3.6 },
  }

  const avgs = avgMap[key] || { pts: 20, reb: 5, ast: 4, stl: 1, blk: 0.5, fg3m: 2 }
  const std = 0.22

  return Array.from({ length: 20 }, () => {
    const v = (k) => {
      const avg = avgs[k] || 0
      return Math.max(0, avg + (Math.random() - 0.5) * 2 * (avg * std))
    }
    return {
      date: null,
      pts:  Math.round(v('pts')  * 2) / 2,
      reb:  Math.round(v('reb')  * 2) / 2,
      ast:  Math.round(v('ast')  * 2) / 2,
      stl:  Math.round(v('stl')  * 2) / 2,
      blk:  Math.round(v('blk')  * 2) / 2,
      fg3m: Math.floor(v('fg3m')),
      _mock: true,
    }
  })
}

// Generic log: generates `value` field around player's typical output
// avgMap covers NFL, MLB, and NHL players
function generateGenericLog(key, statType, line) {
  const playerAvgMap = {
    // NFL QBs
    'patrick mahomes':    { 'Passing Yards': 292, 'Passing TDs': 2.8, 'Pass Attempts': 35, 'Rushing Yards': 22 },
    'josh allen':         { 'Passing Yards': 278, 'Passing TDs': 2.5, 'Pass Attempts': 33, 'Rushing Yards': 45 },
    'lamar jackson':      { 'Passing Yards': 248, 'Passing TDs': 2.4, 'Pass Attempts': 28, 'Rushing Yards': 68 },
    'jalen hurts':        { 'Passing Yards': 252, 'Passing TDs': 2.2, 'Pass Attempts': 30, 'Rushing Yards': 55 },
    // NFL RBs
    'christian mccaffrey':{ 'Rushing Yards': 85, 'Receptions': 5.8, 'Receiving Yards': 46 },
    'derrick henry':      { 'Rushing Yards': 92, 'Receptions': 2.4, 'Receiving Yards': 18 },
    // NFL WRs/TEs
    'travis kelce':       { 'Receiving Yards': 65, 'Receptions': 5.8 },
    'tyreek hill':        { 'Receiving Yards': 85, 'Receptions': 7.1 },
    'ceedee lamb':        { 'Receiving Yards': 90, 'Receptions': 6.9 },
    'stefon diggs':       { 'Receiving Yards': 72, 'Receptions': 6.2 },
    "a.j. brown":         { 'Receiving Yards': 80, 'Receptions': 5.5 },
    // MLB batters
    'shohei ohtani':      { 'Hits': 1.45, 'Total Bases': 2.6, 'Runs Scored': 0.9, 'Home Runs': 0.22 },
    'aaron judge':        { 'Hits': 1.25, 'Total Bases': 2.4, 'Home Runs': 0.28 },
    'freddie freeman':    { 'Hits': 1.40, 'Total Bases': 2.2 },
    'juan soto':          { 'Hits': 1.30, 'Total Bases': 2.1, 'Walks': 1.4 },
    'ronald acuna jr.':   { 'Hits': 1.35, 'Total Bases': 2.2, 'Stolen Bases': 0.55 },
    'yordan alvarez':     { 'Hits': 1.30, 'Total Bases': 2.5 },
    'francisco lindor':   { 'Hits': 1.25, 'Total Bases': 1.9 },
    'bryce harper':       { 'Hits': 1.30, 'Total Bases': 2.3 },
    // MLB pitchers
    'gerrit cole':        { 'Strikeouts': 8.2, 'Pitcher Outs': 17.5 },
    'spencer strider':    { 'Strikeouts': 9.1, 'Pitcher Outs': 17.0 },
    // NHL
    'connor mcdavid':     { 'Points': 1.7, 'Shots on Goal': 4.1, 'Goals': 0.58, 'Assists': 1.12 },
    'leon draisaitl':     { 'Points': 1.5, 'Shots on Goal': 3.8, 'Goals': 0.52 },
    'nathan mackinnon':   { 'Points': 1.55, 'Shots on Goal': 3.9, 'Goals': 0.48 },
    'auston matthews':    { 'Points': 1.3, 'Shots on Goal': 4.5, 'Goals': 0.62 },
    'william nylander':   { 'Points': 1.1, 'Shots on Goal': 3.1 },
    'david pastrnak':     { 'Points': 1.25, 'Shots on Goal': 3.8, 'Goals': 0.55 },
    'artemi panarin':     { 'Points': 1.3, 'Shots on Goal': 2.9 },
    'igor shesterkin':    { 'Saves': 29.2 },
    'evgeni malkin':      { 'Points': 1.0, 'Shots on Goal': 2.8 },
  }

  const playerData = playerAvgMap[key] || {}
  const avg = playerData[statType] ?? line * 1.02  // default close to line
  const std = 0.25

  return Array.from({ length: 20 }, () => {
    const raw = Math.max(0, avg + (Math.random() - 0.5) * 2 * (avg * std))
    const value = statType === 'Home Runs' || statType === 'Goals' || statType === 'Stolen Bases'
      ? Math.round(raw)
      : statType === 'Hits' || statType === 'Points' || statType === 'Assists' || statType === 'Saves'
        ? Math.floor(raw + 0.5)  // round to nearest integer
        : Math.round(raw * 2) / 2  // round to nearest 0.5
    return {
      date: null,
      pts: value,  // keep pts for NBA resolver compat
      reb: 0, ast: 0, stl: 0, blk: 0, fg3m: 0,
      value,
      _mock: true,
    }
  })
}
