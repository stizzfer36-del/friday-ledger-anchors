// Web Push Notification routes
// Manages push subscriptions and allows server to send push events.
// Requires VAPID keys: generate with `npx web-push generate-vapid-keys`

import { Router } from 'express'
import { db } from '../models/db.js'
import { requireAuth } from '../middleware/auth.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'admin@flexedge.io'

let webpush = null
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    const wp = await import('web-push')
    webpush = wp.default || wp
    webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    console.log('[push] Web push initialized with VAPID keys')
  } catch (err) {
    console.warn('[push] web-push package not installed:', err.message)
  }
} else {
  console.log('[push] No VAPID keys — push notifications disabled')
}

// Ensure push_subscriptions table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id        TEXT PRIMARY KEY,
    userId    TEXT NOT NULL,
    endpoint  TEXT NOT NULL UNIQUE,
    auth      TEXT NOT NULL,
    p256dh    TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_push_userId ON push_subscriptions(userId);
`)

// ── Get VAPID public key (needed by frontend to subscribe) ─────────────────────
router.get('/vapid-public-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.json({ enabled: false, message: 'Push notifications not configured' })
  }
  res.json({ enabled: true, publicKey: VAPID_PUBLIC_KEY })
})

// ── Subscribe ─────────────────────────────────────────────────────────────────
router.post('/subscribe', requireAuth, (req, res) => {
  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.auth || !keys?.p256dh) {
    return res.status(400).json({ error: 'endpoint and keys (auth, p256dh) required' })
  }

  // Upsert subscription
  const existing = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(endpoint)
  if (existing) {
    db.prepare('UPDATE push_subscriptions SET userId = ? WHERE endpoint = ?').run(req.user.id, endpoint)
  } else {
    db.prepare(`
      INSERT INTO push_subscriptions (id, userId, endpoint, auth, p256dh, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), req.user.id, endpoint, keys.auth, keys.p256dh, new Date().toISOString())
  }

  res.json({ success: true })
})

// ── Unsubscribe ───────────────────────────────────────────────────────────────
router.delete('/subscribe', requireAuth, (req, res) => {
  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' })
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND userId = ?').run(endpoint, req.user.id)
  res.json({ success: true })
})

// ── Send push to specific user (internal use) ─────────────────────────────────
export async function sendPushToUser(userId, payload) {
  if (!webpush) return { sent: 0 }

  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE userId = ?').all(userId)
  if (!subs.length) return { sent: 0 }

  const message = typeof payload === 'string' ? payload : JSON.stringify(payload)
  let sent = 0
  const expired = []

  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
        message
      )
      sent++
    } catch (err) {
      // 410 Gone = subscription expired/unsubscribed
      if (err.statusCode === 410) expired.push(sub.endpoint)
    }
  }))

  // Clean up expired subscriptions
  if (expired.length) {
    const placeholders = expired.map(() => '?').join(',')
    db.prepare(`DELETE FROM push_subscriptions WHERE endpoint IN (${placeholders})`).run(...expired)
  }

  return { sent, expired: expired.length }
}

// ── Broadcast to all subscribers (model updates, line alerts) ────────────��────
export async function broadcastPush(payload) {
  if (!webpush) return { sent: 0 }

  const subs = db.prepare('SELECT * FROM push_subscriptions').all()
  if (!subs.length) return { sent: 0 }

  const message = typeof payload === 'string' ? payload : JSON.stringify(payload)
  let sent = 0

  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
        message
      )
      sent++
    } catch {}
  }))

  return { sent }
}

export default router
