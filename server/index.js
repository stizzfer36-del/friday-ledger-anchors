import express from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'

// Initialize DB before any model imports
import { db as importedDb } from './models/db.js'

import authRoutes from './routes/auth.js'
import userPicksRoutes from './routes/picks.js'
import userBankrollRoutes from './routes/bankroll.js'
import billingRoutes, { handleStripeWebhook } from './routes/billing.js'
import pushRoutes from './routes/push.js'
import { getDailySlip } from './services/dailySlip.js'
import { getLineMovementAlerts } from './store.js'
import { optionalAuth, requireTier } from './middleware/auth.js'

// ── Simple in-memory rate limiter ─────────────────────────────────────────────
const rl = {}
function rateLimit(maxReq = 60, windowMs = 60000) {
  return (req, res, next) => {
    const key = req.ip || 'local'
    const now = Date.now()
    if (!rl[key] || now - rl[key].start > windowMs) {
      rl[key] = { count: 1, start: now }
    } else {
      rl[key].count++
    }
    if (rl[key].count > maxReq) {
      return res.status(429).json({ error: 'Too many requests. Slow down.' })
    }
    next()
  }
}
import {
  getLiveLines,
  getLastRefresh,
  addPick,
  getPicks,
  updatePickResult,
  addBankrollEntry,
  getBankroll,
  addAlert,
  getAlerts,
  deleteAlert,
  getCalibration,
  getNBAPlayerMap,
  getGameLogCache,
} from './store.js'
import { runFullRefresh, refreshNBAStats, startScheduler } from './services/scheduler.js'
import { buildOptimalSlip } from './services/autoSlip.js'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())
app.use(rateLimit(120, 60000)) // 120 req/min per IP

// ── Stripe webhook (must be raw body before express.json()) ──────────────────
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)

// ── Auth + user routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/user/picks', userPicksRoutes)
app.use('/api/user/bankroll', userBankrollRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api/push', pushRoutes)

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const lines = getLiveLines()
  const refresh = getLastRefresh()
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    linesLoaded: lines.length,
    lastRefresh: refresh,
  })
})

// ── Lines (EV-ranked) ─────────────────────────────────────────────────────────
// Free tier: returns lines but strips EV scores and recommendations
app.get('/api/lines', optionalAuth, (req, res) => {
  const { sport, statType, minEV, recommendation, confidence, search } = req.query
  let lines = getLiveLines()

  if (sport)           lines = lines.filter(l => l.sport === sport)
  if (statType)        lines = lines.filter(l => l.statType === statType)
  if (minEV != null)   lines = lines.filter(l => l.evScore >= parseFloat(minEV))
  if (recommendation)  lines = lines.filter(l => l.recommendation === recommendation)
  if (confidence)      lines = lines.filter(l => l.confidence === confidence)
  if (search) {
    const q = search.toLowerCase()
    lines = lines.filter(l =>
      l.playerName.toLowerCase().includes(q) ||
      l.team.toLowerCase().includes(q)
    )
  }

  // Strip EV data for free / unauthenticated users — show only first 5 lines
  const isPro = req.user && (req.user.tier === 'pro' || req.user.tier === 'elite')
  if (!isPro) {
    lines = lines.slice(0, 5).map(l => ({
      id: l.id, playerName: l.playerName, team: l.team, sport: l.sport,
      statType: l.statType, line: l.line, startTime: l.startTime,
      minutesToGame: l.minutesToGame, injury: l.injury,
      _locked: true,  // signals frontend to show upgrade prompt
    }))
  }

  res.json({
    data: lines,
    meta: {
      total: lines.length,
      lastRefresh: getLastRefresh(),
      generatedAt: new Date().toISOString(),
      tier: req.user?.tier || 'free',
    },
  })
})

app.get('/api/lines/top', (req, res) => {
  const limit = parseInt(req.query.limit) || 10
  const lines = getLiveLines()
    .filter(l => l.recommendation !== 'SKIP' && l.evScore > 0)
    .slice(0, limit)
  res.json(lines)
})

app.get('/api/lines/stat-types', (req, res) => {
  const types = [...new Set(getLiveLines().map(l => l.statType))].sort()
  res.json(types)
})

app.get('/api/lines/:id', (req, res) => {
  const line = getLiveLines().find(l => l.id === req.params.id)
  if (!line) return res.status(404).json({ error: 'Line not found' })
  res.json(line)
})

// ── Picks ─────────────────────────────────────────────────────────────────────
app.post('/api/picks', (req, res) => {
  const { lineId, playerName, team, statType, line, projection, evScore, recommendation, sport, entryAmount } = req.body
  if (!playerName || !statType || !line) {
    return res.status(400).json({ error: 'playerName, statType, and line are required' })
  }
  const pick = addPick({
    id: uuidv4(),
    lineId,
    playerName,
    team,
    statType,
    line,
    projection,
    evScore,
    recommendation,
    sport: sport || 'NBA',
    entryAmount: entryAmount || 0,
    result: null,
    settledAt: null,
    loggedAt: new Date().toISOString(),
  })
  res.status(201).json(pick)
})

app.get('/api/picks', (req, res) => {
  const { result, sport } = req.query
  let picks = getPicks()
  if (result) picks = picks.filter(p => p.result === result)
  if (sport) picks = picks.filter(p => p.sport === sport)
  res.json(picks.slice().reverse())
})

app.put('/api/picks/:id/result', (req, res) => {
  const { result, autoLogBankroll = true } = req.body
  if (!['hit', 'miss'].includes(result)) {
    return res.status(400).json({ error: "result must be 'hit' or 'miss'" })
  }
  const pick = updatePickResult(req.params.id, result)
  if (!pick) return res.status(404).json({ error: 'Pick not found' })

  // Auto-log to bankroll if entry amount was set
  if (autoLogBankroll && pick.entryAmount > 0) {
    const type = result === 'hit' ? 'win' : 'loss'
    const amount = result === 'hit' ? pick.entryAmount * 2 : -pick.entryAmount // simplified 2x payout
    addBankrollEntry({
      id: uuidv4(),
      type,
      amount,
      note: `${pick.playerName} ${pick.statType} ${result === 'hit' ? '✓' : '✗'}`,
      pickId: pick.id,
      createdAt: new Date().toISOString(),
    })
  }

  res.json(pick)
})

// ── Bankroll ──────────────────────────────────────────────────────────────────
app.get('/api/bankroll', (req, res) => {
  const entries = getBankroll()
  const total = entries.reduce((sum, e) => sum + e.amount, 0)
  const deposits = entries.filter(e => e.type === 'deposit').reduce((s, e) => s + e.amount, 0)
  const withdrawals = entries.filter(e => e.type === 'withdrawal').reduce((s, e) => s + e.amount, 0)
  const winnings = entries.filter(e => e.type === 'win').reduce((s, e) => s + e.amount, 0)
  const losses = entries.filter(e => e.type === 'loss').reduce((s, e) => s + e.amount, 0)
  res.json({ entries: entries.slice().reverse(), summary: { balance: total, deposits, withdrawals, winnings, losses, roi: deposits > 0 ? ((winnings + losses) / deposits) * 100 : 0 } })
})

app.post('/api/bankroll/entry', (req, res) => {
  const { type, amount, note, pickId } = req.body
  if (!type || amount == null) return res.status(400).json({ error: 'type and amount required' })
  const entry = addBankrollEntry({
    id: uuidv4(),
    type,
    amount: parseFloat(amount),
    note,
    pickId,
    createdAt: new Date().toISOString(),
  })
  res.status(201).json(entry)
})

// ── Alerts ────────────────────────────────────────────────────────────────────
app.get('/api/alerts', (req, res) => res.json(getAlerts()))

app.post('/api/alerts', (req, res) => {
  const { name, playerName, statType, minEV, sport } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const alert = addAlert({ id: uuidv4(), name, playerName, statType, minEV, sport, createdAt: new Date().toISOString() })
  res.status(201).json(alert)
})

app.delete('/api/alerts/:id', (req, res) => {
  deleteAlert(req.params.id)
  res.status(204).send()
})

// ── Calibration ───────────────────────────────────────────────────────────────
app.get('/api/calibration', (req, res) => {
  res.json(getCalibration())
})

// ── Sharp Slate — model's best picks of the day ───────────────────────────────
app.get('/api/sharp-slate', (req, res) => {
  const lines = getLiveLines()
  const limit = parseInt(req.query.limit) || 8

  // Sharp criteria: EV > 8, not stale, not out/doubtful, confidence not INVALID
  const sharp = lines
    .filter(l =>
      l.evScore >= 8 &&
      !l.isStale &&
      l.confidence !== 'INVALID' &&
      l.injury?.status !== 'out' &&
      l.injury?.status !== 'doubtful'
    )
    .slice(0, limit)

  // Compute slate-level stats
  const avgEV = sharp.length > 0
    ? (sharp.reduce((s, l) => s + l.evScore, 0) / sharp.length).toFixed(1)
    : 0
  const avgHitRate = sharp.length > 0
    ? ((sharp.reduce((s, l) => s + l.hitRate, 0) / sharp.length) * 100).toFixed(1)
    : 0

  res.json({
    picks: sharp,
    meta: {
      count: sharp.length,
      avgEV,
      avgHitRate,
      generatedAt: new Date().toISOString(),
    },
  })
})

// ── Kelly Criterion calculator (Pro+) ────────────────────────────────────────
app.post('/api/kelly', optionalAuth, requireTier('pro'), (req, res) => {
  const { hitRate, payoutMultiplier = 3, bankroll = 1000, fraction = 0.25 } = req.body

  if (hitRate == null || hitRate < 0 || hitRate > 1) {
    return res.status(400).json({ error: 'hitRate must be between 0 and 1' })
  }

  const p = parseFloat(hitRate)
  const b = parseFloat(payoutMultiplier) - 1  // net odds (3x payout → b=2)
  const q = 1 - p

  // Kelly fraction = (p*b - q) / b
  const kelly = (p * b - q) / b
  const safeFraction = parseFloat(fraction)
  const recommendedFraction = Math.max(0, kelly * safeFraction)
  const recommendedBet = parseFloat(bankroll) * recommendedFraction

  res.json({
    kellyFraction: parseFloat(kelly.toFixed(4)),
    safeFraction: parseFloat(recommendedFraction.toFixed(4)),
    recommendedBet: parseFloat(recommendedBet.toFixed(2)),
    breakEvenHitRate: parseFloat((q / (b + 1)).toFixed(4)),
    edge: parseFloat(((p - (q / (b + 1))) * 100).toFixed(2)),
    inputs: { hitRate: p, payoutMultiplier, bankroll, fraction: safeFraction },
  })
})

// ── Correlation check for a slip ──────────────────────────────────────────────
app.post('/api/correlation-check', (req, res) => {
  const { picks } = req.body  // array of { playerName, team, statType }
  if (!Array.isArray(picks) || picks.length === 0) {
    return res.status(400).json({ error: 'picks array required' })
  }

  const warnings = []

  // Team concentration check
  const teamCounts = {}
  picks.forEach(p => {
    if (p.team) {
      teamCounts[p.team] = (teamCounts[p.team] || [])
      teamCounts[p.team].push(p.playerName)
    }
  })
  Object.entries(teamCounts).forEach(([team, players]) => {
    if (players.length >= 2) {
      warnings.push({
        type: 'team_concentration',
        severity: players.length >= 3 ? 'high' : 'medium',
        message: `${players.join(' + ')} are teammates (${team}). Their stats are correlated — a blowout or foul trouble affects both.`,
        players,
        team,
      })
    }
  })

  // Same stat type concentration (e.g. all Points picks)
  const statCounts = {}
  picks.forEach(p => {
    statCounts[p.statType] = (statCounts[p.statType] || 0) + 1
  })
  Object.entries(statCounts).forEach(([stat, count]) => {
    if (count >= 3 && stat === 'Points') {
      warnings.push({
        type: 'stat_concentration',
        severity: 'low',
        message: `${count} Points picks in one slip. A low-scoring night affects all of them.`,
        stat,
        count,
      })
    }
  })

  // PRA/combo overlaps with individual stats (double-counting risk)
  const comboPicks = picks.filter(p => p.statType.includes('+'))
  const simplePicks = picks.filter(p => !p.statType.includes('+'))
  comboPicks.forEach(combo => {
    simplePicks.forEach(simple => {
      if (combo.playerName === simple.playerName) {
        warnings.push({
          type: 'overlap',
          severity: 'medium',
          message: `${combo.playerName} has both a combo pick (${combo.statType}) and an individual pick (${simple.statType}) — these overlap.`,
          player: combo.playerName,
        })
      }
    })
  })

  res.json({
    warnings,
    riskLevel: warnings.some(w => w.severity === 'high') ? 'HIGH'
      : warnings.some(w => w.severity === 'medium') ? 'MEDIUM'
      : warnings.length > 0 ? 'LOW' : 'CLEAN',
    isClean: warnings.length === 0,
  })
})

// ── Line movement summary ─────────────────────────────────────────────────────
app.get('/api/line-movement', (req, res) => {
  const lines = getLiveLines()
  const moved = lines
    .filter(l => l.lineMovement && l.lineMovement.delta !== 0)
    .map(l => ({
      id: l.id,
      playerName: l.playerName,
      team: l.team,
      statType: l.statType,
      currentLine: l.line,
      delta: l.lineMovement.delta,
      direction: l.lineMovement.direction,
      history: l.lineMovement.history,
      evScore: l.evScore,
      recommendation: l.recommendation,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  res.json(moved)
})

// ── Auto Slip — optimal picks generated by the model (Pro+) ──────────────────
app.get('/api/auto-slip', optionalAuth, requireTier('pro'), (req, res) => {
  const { type = 'power', picks = '5', minEV = '1' } = req.query
  const lines = getLiveLines()
  const slip = buildOptimalSlip(lines, {
    pickCount: Math.min(Math.max(parseInt(picks) || 5, 2), 5),
    playType: ['power', 'flex'].includes(type) ? type : 'power',
    minEV: parseFloat(minEV) || 1,
  })
  res.json(slip)
})

// ── Player profile — all lines + full game log + splits ───────────────────────
app.get('/api/player/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name).toLowerCase()
  const allLines = getLiveLines()
  const playerLines = allLines.filter(l => l.playerName.toLowerCase() === name)

  if (playerLines.length === 0) {
    return res.status(404).json({ error: 'Player not found' })
  }

  const firstLine = playerLines[0]

  // Get game log: cache → fallback
  const playerMap = getNBAPlayerMap()
  const mapped = playerMap[name]
  let gameLog = null

  if (mapped) {
    const cached = getGameLogCache(mapped.nbaId)
    if (cached) gameLog = cached.logs
  }

  const { generateFallbackGameLog, getStatResolver } = await import('./services/nbaStats.js')

  if (!gameLog) {
    gameLog = generateFallbackGameLog(firstLine.playerName, 'Points', firstLine.line)
  }

  // Ensure every entry has a date
  const logsWithDates = gameLog.map((g, i) => {
    if (g.date) return g
    const d = new Date()
    d.setDate(d.getDate() - (i * 3 + 1))
    return { ...g, date: d.toISOString().split('T')[0] }
  })

  // Pre-compute per-stat values + splits (deduplicate by statType)
  const statValues = {}
  const splits = {}

  playerLines.forEach(line => {
    if (statValues[line.statType]) return
    const resolver = getStatResolver(line.statType)
    if (!resolver) return

    const values = logsWithDates.map(g => parseFloat(resolver(g).toFixed(1)))
    statValues[line.statType] = values

    const avg = arr => arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0
    const hr  = (arr, l) => arr.length ? Math.round(arr.filter(v => v > l).length / arr.length * 100) : 0

    splits[line.statType] = {
      l5Avg:  avg(values.slice(0, 5)),
      l10Avg: avg(values.slice(0, 10)),
      l20Avg: avg(values),
      l5HR:   hr(values.slice(0, 5),  line.line),
      l10HR:  hr(values.slice(0, 10), line.line),
      l20HR:  hr(values,              line.line),
    }
  })

  res.json({
    name: firstLine.playerName,
    team: firstLine.team,
    position: firstLine.position,
    sport: firstLine.sport || 'NBA',
    injury: firstLine.injury,
    lines: playerLines,
    gameLog: logsWithDates,
    statValues,
    splits,
  })
})

// ── Public model performance (the trust page — no auth required) ──────────────
// Shows verified aggregate track record across all settled picks.
// This is public — it's our credibility page and the reason users pay.
app.get('/api/performance', (req, res) => {
  const perfDb = importedDb
  if (!perfDb) return res.json({ summary: null, note: 'Database not available' })

  const settled = perfDb.prepare(
    "SELECT * FROM user_picks WHERE result IS NOT NULL"
  ).all()

  if (!settled.length) {
    return res.json({
      summary: null,
      byRecommendation: {},
      bySport: {},
      byStatType: {},
      note: 'No settled picks yet — track record builds as users log results',
    })
  }

  const calc = (arr) => {
    const hits = arr.filter(p => p.result === 'hit').length
    return { n: arr.length, hits, hitRate: parseFloat((hits / arr.length).toFixed(3)) }
  }

  const byRec = {}
  const bySport = {}
  const byStatType = {}

  settled.forEach(p => {
    const rec = p.recommendation || 'UNKNOWN'
    if (!byRec[rec]) byRec[rec] = []
    byRec[rec].push(p)
    if (!bySport[p.sport]) bySport[p.sport] = []
    bySport[p.sport].push(p)
    if (!byStatType[p.statType]) byStatType[p.statType] = []
    byStatType[p.statType].push(p)
  })

  res.json({
    summary: calc(settled),
    byRecommendation: Object.fromEntries(Object.entries(byRec).map(([k, v]) => [k, calc(v)])),
    bySport: Object.fromEntries(Object.entries(bySport).map(([k, v]) => [k, calc(v)])),
    byStatType: Object.fromEntries(Object.entries(byStatType).map(([k, v]) => [k, calc(v)])),
    updatedAt: new Date().toISOString(),
  })
})

// ── Daily picks feed — the core product (Pro+) ────────────────────────────────
// Partially public: topPicks blurred for free users, full access for Pro.
app.get('/api/daily-slip', optionalAuth, (req, res) => {
  const slip = getDailySlip()
  const isPro = req.user && (req.user.tier === 'pro' || req.user.tier === 'elite')

  if (!isPro) {
    // Free users see first 3 picks blurred
    return res.json({
      ...slip,
      topPicks: (slip.topPicks || []).slice(0, 3).map(p => ({ ...p, _locked: true })),
      power5: null,
      power3: null,
      flex5: null,
      _limited: true,
    })
  }

  res.json(slip)
})

// ── Line movement alerts ───────────────────────────────────────────────────────
// Returns lines that moved significantly since last check (for in-app notifications)
app.get('/api/line-alerts', optionalAuth, (req, res) => {
  const movements = getLineMovementAlerts()
  const significant = movements.filter(m => Math.abs(m.delta) >= 0.5)
  res.json({
    alerts: significant,
    count: significant.length,
    checkedAt: new Date().toISOString(),
  })
})

// ── Settlement trigger (manual, admin use) ────────────────────────────────────
app.post('/api/settle', async (req, res) => {
  const { settlePendingPicks } = await import('./services/settlementService.js')
  const result = await settlePendingPicks()
  res.json({ ...result, triggeredAt: new Date().toISOString() })
})

// ── Shareable pick permalink ───────────────────────────────────────────────────
app.get('/api/pick/:slug', (req, res) => {
  const slug = req.params.slug
  const dailySlip = getDailySlip()
  const pick = (dailySlip.topPicks || []).find(p => p.shareSlug === slug)
  if (!pick) return res.status(404).json({ error: 'Pick not found or expired' })
  res.json(pick)
})

// ── Manual refresh ────────────────────────────────────────────────────────────
app.post('/api/refresh', async (req, res) => {
  res.json({ message: 'Refresh started', timestamp: new Date().toISOString() })
  runFullRefresh()
})

// ── Startup ───────────────────────────────────────────────────────────────────
async function boot() {
  console.log('FlexEdge EV Engine starting...')

  // Load NBA player map first (needed for EV calculation)
  await refreshNBAStats()

  // Then run initial full refresh
  await runFullRefresh()

  // Start background scheduler
  startScheduler()

  app.listen(PORT, () => {
    console.log(`FlexEdge API running on port ${PORT}`)
    console.log(`Lines loaded: ${getLiveLines().length}`)
  })
}

boot().catch(err => {
  console.error('Boot failed:', err)
  process.exit(1)
})
