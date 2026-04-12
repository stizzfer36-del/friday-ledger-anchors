// Per-user picks routes (authenticated)
// Replaces the global picks CRUD in index.js for logged-in users.

import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../models/db.js'
import { addUserPick, getUserPicks, settleUserPick, getUserCalibration } from '../models/Pick.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// All routes require auth
router.use(requireAuth)

// ── Save a pick ───────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { lineId, playerName, team, statType, line, projection, evScore, recommendation, sport, entryAmount, direction } = req.body
  if (!playerName || !statType || line == null) {
    return res.status(400).json({ error: 'playerName, statType, and line are required' })
  }

  const pick = addUserPick(req.user.id, {
    lineId, playerName, team, statType, line, projection, evScore,
    recommendation, sport, entryAmount, direction,
  })
  res.status(201).json(pick)
})

// ── Get picks ─────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { result, sport } = req.query
  const picks = getUserPicks(req.user.id, { result, sport })
  res.json(picks)
})

// ── Settle a pick ─────────────────────────────────────────────────────────────
router.put('/:id/result', (req, res) => {
  const { result, autoLogBankroll = true } = req.body
  if (!['hit', 'miss'].includes(result)) {
    return res.status(400).json({ error: "result must be 'hit' or 'miss'" })
  }

  const pick = settleUserPick(req.user.id, req.params.id, result)
  if (!pick) return res.status(404).json({ error: 'Pick not found' })

  // Auto-log to bankroll
  if (autoLogBankroll && pick.entryAmount > 0) {
    const type = result === 'hit' ? 'win' : 'loss'
    const amount = result === 'hit' ? pick.entryAmount * 2 : -pick.entryAmount
    db.prepare(`
      INSERT INTO user_bankroll (id, userId, type, amount, note, pickId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), req.user.id, type, amount,
      `${pick.playerName} ${pick.statType} ${result === 'hit' ? '✓' : '✗'}`,
      pick.id, new Date().toISOString()
    )
  }

  res.json(pick)
})

// ── Personal calibration ──────────────────────────────────────────────────────
router.get('/calibration', (req, res) => {
  res.json(getUserCalibration(req.user.id))
})

export default router
