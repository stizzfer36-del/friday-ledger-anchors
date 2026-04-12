// JWT auth middleware + tier gating

import { verifyToken, getUserById, TIERS } from '../models/User.js'

/**
 * requireAuth — verifies JWT and attaches req.user
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Authentication required' })

  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' })

  const user = getUserById(payload.sub)
  if (!user) return res.status(401).json({ error: 'User not found' })

  req.user = user
  next()
}

/**
 * optionalAuth — attaches req.user if token present, otherwise req.user = null
 */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token) {
    const payload = verifyToken(token)
    if (payload) req.user = getUserById(payload.sub) || null
  }
  next()
}

/**
 * requireTier — gates a route behind a minimum subscription tier.
 * Tier order: free < pro < elite
 */
const TIER_ORDER = { free: 0, pro: 1, elite: 2 }

export function requireTier(minTier) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' })
    const userLevel = TIER_ORDER[req.user.tier] ?? 0
    const required  = TIER_ORDER[minTier] ?? 1
    if (userLevel < required) {
      const tierInfo = TIERS[minTier]
      return res.status(403).json({
        error: `${tierInfo?.label || minTier} subscription required`,
        requiredTier: minTier,
        currentTier: req.user.tier,
        upgradeUrl: '/pricing',
      })
    }
    next()
  }
}
