// Injury monitor — merges RotoWire (all teams) + ESPN rosters
// RotoWire /tables/ JSON is the fastest full-league injury feed with no auth

export async function fetchInjuryMap() {
  const [rotowire, espn] = await Promise.allSettled([
    fetchRotoWireInjuries(),
    fetchESPNRosterInjuries(),
  ])

  const map = {}

  // ESPN as base (has healthy players too)
  if (espn.status === 'fulfilled') Object.assign(map, espn.value)

  // RotoWire overwrites — it's more current for actual injury status
  if (rotowire.status === 'fulfilled') Object.assign(map, rotowire.value)

  const count = Object.keys(map).length
  console.log(`[injuries] Loaded status for ${count} players (RotoWire + ESPN)`)
  return count > 0 ? map : {}
}

// ── RotoWire — full 30-team injury list, free JSON endpoint ──────────────────
async function fetchRotoWireInjuries() {
  const sports = [
    { url: 'https://www.rotowire.com/basketball/tables/injury-report.php?team=ALL&pos=ALL', sport: 'NBA' },
    { url: 'https://www.rotowire.com/baseball/tables/injury-report.php?team=ALL&pos=ALL', sport: 'MLB' },
    { url: 'https://www.rotowire.com/hockey/tables/injury-report.php?team=ALL&pos=ALL', sport: 'NHL' },
    { url: 'https://www.rotowire.com/football/tables/injury-report.php?team=ALL&pos=ALL', sport: 'NFL' },
  ]

  const results = await Promise.allSettled(
    sports.map(({ url }) =>
      fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
        signal: AbortSignal.timeout(8000),
      }).then(r => r.ok ? r.json() : [])
    )
  )

  const map = {}
  const now = new Date().toISOString()

  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return
    const sport = sports[i].sport
    for (const player of (r.value || [])) {
      const name = player.player?.toLowerCase()
      if (!name) continue
      const rawStatus = (player.status || '').toLowerCase()
      let status = 'healthy'
      if (rawStatus.includes('out')) status = 'out'
      else if (rawStatus.includes('doubtful')) status = 'doubtful'
      else if (rawStatus.includes('questionable') || rawStatus.includes('gtd')) status = 'questionable'
      else if (rawStatus.includes('probable')) status = 'probable'
      else if (rawStatus.includes('day-to-day') || rawStatus.includes('dtd')) status = 'questionable'

      map[name] = {
        status,
        reason: player.injury || null,
        team: player.team || '',
        sport,
        source: 'rotowire',
        updatedAt: now,
      }
    }
  })

  return map
}

// ── ESPN rosters — all 30 NBA teams (marks healthy players too) ───────────────
const NBA_TEAMS = [
  'atl','bos','bkn','cha','chi','cle','dal','den','det','gsw',
  'hou','ind','lac','lal','mem','mia','mil','min','nop','nyk',
  'okc','orl','phi','phx','por','sac','sas','tor','uta','was'
]

async function fetchESPNRosterInjuries() {
  const results = await Promise.allSettled(
    NBA_TEAMS.map(team =>
      fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team}/roster`, {
        signal: AbortSignal.timeout(6000),
      }).then(r => r.ok ? r.json() : null)
    )
  )

  const map = {}
  const now = new Date().toISOString()

  results.forEach(r => {
    if (r.status !== 'fulfilled' || !r.value) return
    const athletes = r.value.athletes || []
    athletes.forEach(group => {
      const items = group.items || (Array.isArray(group) ? group : [group])
      items.forEach(athlete => {
        const name = (athlete.fullName || athlete.displayName || '').toLowerCase()
        if (!name) return
        const injuries = athlete.injuries || []
        const statusObj = athlete.status || {}
        const injury = injuries[0]

        let status = 'healthy'
        let reason = null

        if (injury || statusObj.type) {
          const rawStatus = (injury?.status || statusObj.type || '').toLowerCase()
          if (rawStatus.includes('out')) status = 'out'
          else if (rawStatus.includes('doubtful')) status = 'doubtful'
          else if (rawStatus.includes('questionable') || rawStatus.includes('gtd')) status = 'questionable'
          else if (rawStatus.includes('probable')) status = 'probable'
          reason = injury?.details?.detail || injury?.type || statusObj.description || null
        }

        map[name] = { status, reason, source: 'espn', updatedAt: now }
      })
    })
  })

  return map
}
