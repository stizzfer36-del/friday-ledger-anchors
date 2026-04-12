// Auth routes: register, login, me

import { Router } from 'express'
import { db } from '../models/db.js'
import {
  createUser,
  getUserByEmail,
  verifyPassword,
  signToken,
  TIERS,
} from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  try {
    const existing = getUserByEmail(email)
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const user = createUser({ email, password })
    const token = signToken(user.id)

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        tierInfo: TIERS[user.tier],
        createdAt: user.createdAt,
      },
    })
  } catch (err) {
    console.error('[auth] register error:', err.message)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    // Fetch with password hash for verification
    const userWithHash = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase().trim())

    if (!userWithHash || !verifyPassword(userWithHash, password)) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = signToken(userWithHash.id)

    res.json({
      token,
      user: {
        id: userWithHash.id,
        email: userWithHash.email,
        tier: userWithHash.tier,
        tierInfo: TIERS[userWithHash.tier],
        createdAt: userWithHash.createdAt,
      },
    })
  } catch (err) {
    console.error('[auth] login error:', err.message)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ── Me (current user) ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      tier: req.user.tier,
      tierInfo: TIERS[req.user.tier],
      createdAt: req.user.createdAt,
    },
  })
})

export default router
