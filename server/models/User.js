// User model — registration, auth, and tier management

import { db } from './db.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

const JWT_SECRET = process.env.JWT_SECRET || 'flexedge-dev-secret-change-in-production'
const JWT_EXPIRES = '30d'
const BCRYPT_ROUNDS = 10

// Tier definitions — what each tier can access
export const TIERS = {
  free:  { label: 'Free',  maxPicksPerDay: 5, evScores: false, autoSlip: false, kelly: false },
  pro:   { label: 'Pro',   maxPicksPerDay: null, evScores: true, autoSlip: true, kelly: true },
  elite: { label: 'Elite', maxPicksPerDay: null, evScores: true, autoSlip: true, kelly: true, api: true },
}

export function createUser({ email, password }) {
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS)
  const now = new Date().toISOString()
  const id = uuidv4()
  const stmt = db.prepare(`
    INSERT INTO users (id, email, password, tier, createdAt, updatedAt)
    VALUES (?, ?, ?, 'free', ?, ?)
  `)
  stmt.run(id, email.toLowerCase().trim(), hash, now, now)
  return getUserById(id)
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) || null
}

export function getUserById(id) {
  return db.prepare('SELECT id, email, tier, stripeId, createdAt, updatedAt FROM users WHERE id = ?').get(id) || null
}

export function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password || '')
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export function updateUserTier(userId, tier) {
  const now = new Date().toISOString()
  db.prepare('UPDATE users SET tier = ?, updatedAt = ? WHERE id = ?').run(tier, now, userId)
}

export function updateStripeId(userId, stripeId) {
  const now = new Date().toISOString()
  db.prepare('UPDATE users SET stripeId = ?, updatedAt = ? WHERE id = ?').run(stripeId, now, userId)
}
