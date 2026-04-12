// Auto Slip Builder
// Greedy algorithm: finds the highest-EV combination of N picks
// with correlation constraints — what paid capper services do by hand.

const POWER_PAYOUTS = { 2: 3, 3: 5, 4: 10, 5: 20 }
const FLEX_ALL_HIT  = { 2: 3, 3: 2.25, 4: 5, 5: 10 }
const FLEX_ONE_MISS = { 2: null, 3: 1.25, 4: 1.5, 5: 2 }

export function buildOptimalSlip(lines, { pickCount = 5, playType = 'power', minEV = 1 } = {}) {
  // Filter to valid, non-risky candidates
  const candidates = lines
    .filter(l =>
      l.evScore >= minEV &&
      l.recommendation !== 'SKIP' &&
      l.confidence !== 'INVALID' &&
      l.injury?.status !== 'out' &&
      l.injury?.status !== 'doubtful' &&
      !l.isStale
    )
    .sort((a, b) => b.evScore - a.evScore)

  const selected = []
  const teamCounts = {}
  const seenPlayers = new Set()

  for (const line of candidates) {
    if (selected.length >= pickCount) break

    // No duplicate players across stat types
    if (seenPlayers.has(line.playerName)) continue

    // Correlation cap: 1 player per team for Power, 2 for Flex
    const teamMax = playType === 'power' ? 1 : 2
    if ((teamCounts[line.team] || 0) >= teamMax) continue

    // Diversify stat types — max 2 of the same type in a slip
    const sameStatCount = selected.filter(s => s.statType === line.statType).length
    if (sameStatCount >= 2) continue

    selected.push(line)
    teamCounts[line.team] = (teamCounts[line.team] || 0) + 1
    seenPlayers.add(line.playerName)
  }

  const n = selected.length
  const fullPayout   = (playType === 'power' ? POWER_PAYOUTS : FLEX_ALL_HIT)[n]  ?? null
  const insurePayout = playType === 'flex' ? (FLEX_ONE_MISS[n] ?? null) : null
  const avgEV        = n > 0 ? parseFloat((selected.reduce((s, l) => s + l.evScore, 0) / n).toFixed(1)) : 0
  const avgHitRate   = n > 0 ? parseFloat((selected.reduce((s, l) => s + l.hitRate, 0) / n).toFixed(3)) : 0.5

  return {
    picks: selected,
    playType,
    pickCount: n,
    fullPayout,
    insurePayout,
    avgEV,
    avgHitRate,
    generatedAt: new Date().toISOString(),
  }
}
