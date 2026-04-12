// EV Calculation Engine
// Core logic: for each PrizePicks line, compute hit rate, edge, EV score,
// staleness, and recommendation label — with four real strategic adjustments:
// 1) Opponent defensive ranking  2) B2B / rest days
// 3) Implied game total (pace)   4) Consistency / variance score

import {
  getNBAPlayerMap,
  getGameLogCache,
  setGameLogCache,
  isGameLogStale,
  getInjuryStatus,
  recordLineHistory,
  getLineMovement,
} from '../store.js'

import {
  fetchPlayerGameLog,
  getStatResolver,
  generateFallbackGameLog,
} from './nbaStats.js'

import { getDefenseAdjustment } from './defenseRankings.js'
import { getScheduleContext, getRestAdjustment } from './scheduleService.js'
import { getGameTotalAdjustment } from './oddsService.js'

// ── EV constants ──────────────────────────────────────────────────────────────
const MIN_SAMPLE = 5
const TARGET_SAMPLE = 20
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000  // 2 hours

// ── Schedule cache (fetched once per enrichLines call) ────────────────────────
let scheduleContextCache = {}

// ── Main enrichment function ──────────────────────────────────────────────────
export async function enrichLines(rawLines) {
  // Pre-fetch schedule context for all sports present in raw lines
  const sports = [...new Set(rawLines.map(l => l.sport).filter(Boolean))]
  scheduleContextCache = {}
  await Promise.all(sports.map(async s => {
    try { scheduleContextCache[s] = await getScheduleContext(s) } catch (_) {}
  }))

  const enriched = await Promise.all(rawLines.map(line => enrichLine(line)))
  return enriched
    .filter(Boolean)
    .sort((a, b) => b.evScore - a.evScore)
}

async function enrichLine(line) {
  try {
    const resolver = getStatResolver(line.statType)
    if (!resolver) return null

    // ── Get game log ──────────────────────────────────────────────────────────
    const { logs, source } = await getOrFetchGameLog(line.playerName, line.statType, line.line)
    if (!logs || logs.length === 0) return null

    // ── Calculate stat values from logs ───────────────────────────────────────
    const values = logs.map(resolver)
    const sampleSize = values.length

    // ── Base hit rate: % of games where player exceeded the line ─────────────
    const overs = values.filter(v => v > line.line).length
    const hitRate = sampleSize > 0 ? overs / sampleSize : 0.5

    // ── Base projection: weighted avg (70% last 5, 30% full sample) ──────────
    const last5 = values.slice(0, 5)
    const last5Avg = last5.reduce((a, b) => a + b, 0) / last5.length
    const fullAvg = values.reduce((a, b) => a + b, 0) / values.length
    const baseProjection = sampleSize >= 5
      ? last5Avg * 0.7 + fullAvg * 0.3
      : fullAvg

    // ── Trend: L3 avg vs full avg ─────────────────────────────────────────────
    const last3 = values.slice(0, 3)
    const last3Avg = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : fullAvg
    const trendRatio = fullAvg > 0 ? last3Avg / fullAvg : 1
    const trend = trendRatio >= 1.08 ? 'hot' : trendRatio <= 0.92 ? 'cold' : 'neutral'
    const trendDelta = parseFloat((last3Avg - fullAvg).toFixed(1))

    // ── [1] OPPONENT DEFENSE ADJUSTMENT ──────────────────────────────────────
    // Use line.opponent if set; otherwise look up from schedule context
    const schedCtx = scheduleContextCache[line.sport] || {}
    const teamCtx = schedCtx[line.team?.toUpperCase()] || {}
    const opponent = line.opponent || teamCtx.opponent || null
    const isHome   = line.isHome   != null ? line.isHome   : (teamCtx.isHome ?? null)
    const daysRest = line.daysRest != null ? line.daysRest : (teamCtx.daysRest ?? null)

    const defAdj = getDefenseAdjustment(opponent, line.sport)

    // ── [2] REST DAYS PENALTY ──────────────────────────────────────────────────
    const restAdj = getRestAdjustment(daysRest)

    // ── [3] IMPLIED GAME TOTAL ADJUSTMENT ──────────────────────────────────────
    let paceAdj = { multiplier: 1.0, adjustment: 0, label: null, total: null }
    try {
      paceAdj = await getGameTotalAdjustment(line.team, opponent, line.sport)
    } catch (_) {}

    // ── [4] CONSISTENCY / VARIANCE SCORING ────────────────────────────────────
    const consistency = computeConsistency(values)

    // ── Adjusted projection (apply all multipliers) ────────────────────────────
    const adjustedProjection = parseFloat(
      (baseProjection * defAdj.multiplier * restAdj.multiplier * paceAdj.multiplier).toFixed(1)
    )

    // ── Adjusted hit rate against the line (how often proj-adjusted player clears) ──
    // Re-assess hit rate using adjusted projection as center of distribution
    const projShift = adjustedProjection - baseProjection
    const adjustedOvers = values.filter(v => (v + projShift) > line.line).length
    const adjustedHitRate = sampleSize > 0 ? adjustedOvers / sampleSize : 0.5

    // ── Line value ────────────────────────────────────────────────────────────
    const overPct = line.line > 0 ? (adjustedProjection - line.line) / line.line : 0
    const lineValue = Math.abs(overPct) <= 0.03 ? 'tight' : Math.abs(overPct) >= 0.08 ? 'soft' : 'fair'

    // ── Edge ──────────────────────────────────────────────────────────────────
    const edge = (adjustedHitRate - 0.5) * 100

    // ── Sample confidence ──────────────────────────────────────────────────────
    // Downgrade confidence when player is inconsistent
    const consistencyMultiplier = consistency.cv <= 0.25 ? 1.0 : consistency.cv <= 0.35 ? 0.85 : 0.70
    const sampleConfidence = Math.min(sampleSize / TARGET_SAMPLE, 1) * consistencyMultiplier

    // ── Staleness factor ──────────────────────────────────────────────────────
    const fetchedAt = new Date(line.fetchedAt).getTime()
    const ageMs = Date.now() - fetchedAt
    const stalenessFactor = Math.max(0, 1 - ageMs / STALE_THRESHOLD_MS)
    const isStale = ageMs > STALE_THRESHOLD_MS

    // ── EV score ──────────────────────────────────────────────────────────────
    const evScore = parseFloat((edge * sampleConfidence * stalenessFactor).toFixed(1))

    // ── Injury status ─────────────────────────────────────────────────────────
    const injury = getInjuryStatus(line.playerName)
    const injuryPenalty = getInjuryPenalty(injury.status)
    const adjustedEvScore = parseFloat((evScore * injuryPenalty).toFixed(1))

    // ── Confidence label ──────────────────────────────────────────────────────
    const confidence = getConfidenceLabel(sampleSize, injury.status, isStale, consistency.label)

    // ── Recommendation label ──────────────────────────────────────────────────
    const recommendation = getRecommendation(adjustedEvScore, confidence)

    // ── Pick direction ────────────────────────────────────────────────────────
    const pick = adjustedProjection > line.line ? 'OVER' : 'UNDER'

    // ── Record line history + movement ────────────────────────────────────────
    recordLineHistory(line.playerName, line.statType, line.line)
    const lineMovement = getLineMovement(line.playerName, line.statType)

    // ── Time to game ──────────────────────────────────────────────────────────
    const minutesToGame = line.startTime
      ? Math.max(0, Math.round((new Date(line.startTime) - Date.now()) / 60000))
      : null

    // ── Recent game summaries ─────────────────────────────────────────────────
    const recentGames = logs.slice(0, 5).map(g => ({
      statValue: parseFloat(resolver(g).toFixed(1)),
      hitOver: resolver(g) > line.line,
    }))

    // ── Context factors array (for frontend display) ──────────────────────────
    const contextFactors = buildContextFactors({
      defAdj, restAdj, paceAdj, consistency, opponent, daysRest,
    })

    // ── Reasoning text ────────────────────────────────────────────────────────
    const reasoning = buildReasoning({
      playerName: line.playerName,
      statType: line.statType,
      line: line.line,
      last3Avg,
      hitRate: adjustedHitRate,
      sampleSize,
      trend,
      trendDelta,
      injury,
      lineMovement,
      lineValue,
      defAdj,
      restAdj,
      paceAdj,
      consistency,
      adjustedProjection,
      baseProjection,
      opponent,
      daysRest,
    })

    return {
      ...line,
      opponent,
      isHome,
      daysRest,
      projection: parseFloat(baseProjection.toFixed(1)),
      adjustedProjection,
      hitRate: parseFloat(adjustedHitRate.toFixed(3)),
      rawHitRate: parseFloat(hitRate.toFixed(3)),
      hitRateDisplay: `${adjustedOvers}/${sampleSize}`,
      sampleSize,
      edge: parseFloat(edge.toFixed(1)),
      evScore: adjustedEvScore,
      confidence,
      recommendation,
      trend,
      trendDelta,
      lineValue,
      pick,
      reasoning,
      injury: {
        status: injury.status,
        reason: injury.reason,
        updatedAt: injury.updatedAt,
      },
      isStale,
      staleAge: Math.round(ageMs / 60000),
      minutesToGame,
      recentGames,
      lineMovement,
      dataSource: source,
      calculatedAt: new Date().toISOString(),
      contextFactors,
      consistency,
      defenseAdj: defAdj,
      restAdjustment: restAdj,
      paceAdjustment: paceAdj,
    }
  } catch (err) {
    console.error(`[evEngine] Failed to enrich ${line.playerName} ${line.statType}: ${err.message}`)
    return null
  }
}

// ── Consistency / Variance ────────────────────────────────────────────────────
function computeConsistency(values) {
  if (!values || values.length < 3) {
    return { cv: 0.3, label: 'MEDIUM', emoji: '~' }
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean === 0) return { cv: 1, label: 'LOW', emoji: '⚡' }

  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stddev = Math.sqrt(variance)
  const cv = parseFloat((stddev / mean).toFixed(3))

  if (cv <= 0.25) return { cv, label: 'HIGH', emoji: '✓' }
  if (cv <= 0.35) return { cv, label: 'MEDIUM', emoji: '~' }
  return { cv, label: 'LOW', emoji: '⚡' }
}

// ── Game log fetch with cache ─────────────────────────────────────────────────
async function getOrFetchGameLog(playerName, statType, line) {
  const playerMap = getNBAPlayerMap()
  const mapped = playerMap[playerName.toLowerCase()]

  if (mapped && !isGameLogStale(mapped.nbaId)) {
    const cached = getGameLogCache(mapped.nbaId)
    return { logs: cached.logs, source: 'cache' }
  }

  if (mapped) {
    const logs = await fetchPlayerGameLog(mapped.nbaId)
    if (logs && logs.length > 0) {
      setGameLogCache(mapped.nbaId, logs)
      return { logs, source: 'nba_api' }
    }
  }

  const logs = generateFallbackGameLog(playerName, statType, line)
  return { logs, source: 'model' }
}

// ── Context factors array ─────────────────────────────────────────────────────
function buildContextFactors({ defAdj, restAdj, paceAdj, consistency, opponent, daysRest }) {
  const factors = []

  if (opponent && defAdj.rank != null) {
    factors.push({
      type: 'defense',
      label: `vs ${opponent} (${defAdj.grade} defense)`,
      value: defAdj.pct,
      rank: defAdj.rank,
      total: defAdj.total,
      grade: defAdj.grade,
    })
  }

  if (restAdj.penalty !== 0) {
    factors.push({
      type: 'rest',
      label: restAdj.label,
      value: restAdj.penalty,
      daysRest,
    })
  }

  if (paceAdj.label) {
    factors.push({
      type: 'pace',
      label: paceAdj.label,
      value: paceAdj.adjustment,
      total: paceAdj.total,
    })
  }

  factors.push({
    type: 'consistency',
    label: `${consistency.label} consistency`,
    value: null,
    cv: consistency.cv,
    emoji: consistency.emoji,
  })

  return factors
}

// ── Reasoning text ────────────────────────────────────────────────────────────
function buildReasoning({
  playerName, statType, line, last3Avg, hitRate, sampleSize,
  trend, trendDelta, injury, lineMovement, lineValue,
  defAdj, restAdj, paceAdj, consistency, adjustedProjection, baseProjection,
  opponent, daysRest,
}) {
  const parts = []

  // Adjusted projection vs line
  const projVsLine = adjustedProjection - line
  const projDir = projVsLine > 0 ? 'above' : 'below'
  parts.push(`Adj. proj ${adjustedProjection} (${projDir > 0 ? '+' : ''}${projVsLine.toFixed(1)} vs line ${line})`)

  // Hit rate
  if (sampleSize >= 5) {
    const hrPct = Math.round(hitRate * 100)
    parts.push(`${hrPct}% hit rate (${sampleSize}G)`)
  }

  // Trend
  if (trend === 'hot')  parts.push(`Trending UP +${Math.abs(trendDelta)}`)
  if (trend === 'cold') parts.push(`Trending DOWN ${trendDelta}`)

  // Defense adjustment
  if (opponent && defAdj.rank != null && Math.abs(defAdj.pct) >= 3) {
    const defLabel = defAdj.pct < 0 ? `vs ${opponent} (${defAdj.grade} D): ${defAdj.pct}%` : `vs ${opponent} (${defAdj.grade} D): +${defAdj.pct}%`
    parts.push(defLabel)
  }

  // Rest days
  if (restAdj.penalty !== 0) {
    parts.push(`${restAdj.label}: ${restAdj.penalty}%`)
  }

  // Pace / total
  if (paceAdj.label && Math.abs(paceAdj.adjustment) >= 2) {
    const sign = paceAdj.adjustment > 0 ? '+' : ''
    parts.push(`${paceAdj.label}: ${sign}${paceAdj.adjustment}%`)
  }

  // Consistency
  if (consistency.label === 'LOW') parts.push('High variance — unreliable')
  if (consistency.label === 'HIGH') parts.push('Very consistent scorer')

  // Line value
  if (lineValue === 'soft')  parts.push('Line looks soft')
  if (lineValue === 'tight') parts.push('Tight line')

  // Injury
  const s = injury?.status
  if (s && s !== 'healthy' && s !== 'unknown') {
    const label = { probable: 'Probable', questionable: 'Questionable', doubtful: 'Doubtful', out: 'OUT' }[s] || s
    parts.push(`${label}${injury.reason ? ': ' + injury.reason : ''}`)
  }

  // Line movement
  if (lineMovement?.delta != null && lineMovement.delta !== 0) {
    const dir = lineMovement.direction === 'down' ? 'dropped' : 'raised'
    parts.push(`Line ${dir} ${Math.abs(lineMovement.delta).toFixed(1)}`)
  }

  return parts.join(' · ')
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInjuryPenalty(status) {
  return { healthy: 1.0, probable: 0.95, questionable: 0.6, doubtful: 0.2, out: 0, unknown: 0.85 }[status] ?? 0.85
}

function getConfidenceLabel(sampleSize, injuryStatus, isStale, consistencyLabel) {
  if (injuryStatus === 'out' || injuryStatus === 'doubtful') return 'INVALID'
  if (isStale) return 'LOW'
  if (injuryStatus === 'questionable') return 'LOW'
  if (consistencyLabel === 'LOW') return 'LOW'
  if (sampleSize >= TARGET_SAMPLE && injuryStatus === 'healthy' && consistencyLabel === 'HIGH') return 'HIGH'
  if (sampleSize >= 10) return 'MEDIUM'
  return 'LOW'
}

function getRecommendation(evScore, confidence) {
  if (confidence === 'INVALID') return 'SKIP'
  if (evScore >= 15) return 'STRONG'
  if (evScore >= 8)  return 'GOOD'
  if (evScore >= 3)  return 'LEAN'
  if (evScore >= -3) return 'NEUTRAL'
  return 'FADE'
}
