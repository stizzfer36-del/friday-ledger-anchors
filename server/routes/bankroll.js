// Per-user bankroll routes (authenticated)

import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../models/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// ── Get bankroll summary + entries ────────────────────────────────────────────
router.get('/', (req, res) => {
  const entries = db.prepare(
    'SELECT * FROM user_bankroll WHERE userId = ? ORDER BY createdAt ASC'
  ).all(req.user.id)

  const total        = entries.reduce((s, e) => s + e.amount, 0)
  const deposits     = entries.filter(e => e.type === 'deposit').reduce((s, e) => s + e.amount, 0)
  const withdrawals  = entries.filter(e => e.type === 'withdrawal').reduce((s, e) => s + e.amount, 0)
  const winnings     = entries.filter(e => e.type === 'win').reduce((s, e) => s + e.amount, 0)
  const losses       = entries.filter(e => e.type === 'loss').reduce((s, e) => s + e.amount, 0)
  const roi          = deposits > 0 ? ((winnings + losses) / deposits) * 100 : 0

  res.json({
    entries: entries.slice().reverse(),
    summary: { balance: total, deposits, withdrawals, winnings, losses, roi },
  })
})

// ── Add an entry ──────────────────────────────────────────────────────────────
router.post('/entry', (req, res) => {
  const { type, amount, note, pickId } = req.body
  if (!type || amount == null) return res.status(400).json({ error: 'type and amount required' })

  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO user_bankroll (id, userId, type, amount, note, pickId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, type, parseFloat(amount), note || null, pickId || null, now)

  const entry = db.prepare('SELECT * FROM user_bankroll WHERE id = ?').get(id)
  res.status(201).json(entry)
})

export default router
