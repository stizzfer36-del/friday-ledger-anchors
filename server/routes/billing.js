// Stripe billing routes
// Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env to activate.
// Without keys, all billing endpoints return mock responses for development.

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { updateUserTier, updateStripeId } from '../models/User.js'

const router = Router()

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

// Price IDs — create these in Stripe dashboard and set in env
const PRICE_IDS = {
  pro:   process.env.STRIPE_PRO_PRICE_ID   || 'price_pro_placeholder',
  elite: process.env.STRIPE_ELITE_PRICE_ID || 'price_elite_placeholder',
}

let stripe = null
if (STRIPE_SECRET) {
  const { default: Stripe } = await import('stripe')
  stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2023-10-16' })
  console.log('[billing] Stripe initialized')
} else {
  console.log('[billing] No STRIPE_SECRET_KEY — running in mock mode')
}

// ── Pricing info (public) ─────────────────────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        period: null,
        features: [
          '5 lines per day (no EV scores)',
          'Basic player stats',
          'Manual pick tracking',
        ],
        cta: 'Current plan',
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 40,
        period: 'month',
        priceId: PRICE_IDS.pro,
        features: [
          'All lines with full EV scores',
          'STRONG / GOOD / LEAN signals',
          'Auto-slip builder',
          'Kelly criterion sizing',
          'Line movement alerts',
          'Personal calibration tracking',
          'Daily best picks feed',
        ],
        cta: 'Start Pro',
        highlight: true,
      },
      {
        id: 'elite',
        name: 'Elite',
        price: 60,
        period: 'month',
        priceId: PRICE_IDS.elite,
        features: [
          'Everything in Pro',
          'Push notifications (line moves, settlements)',
          'REST API access',
          'Priority model updates',
          'Early access to new sports',
        ],
        cta: 'Start Elite',
      },
    ],
  })
})

// ── Create checkout session ───────────────────────────────────────────────────
router.post('/checkout', requireAuth, async (req, res) => {
  const { plan } = req.body
  if (!['pro', 'elite'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan. Choose pro or elite.' })
  }

  // Mock mode: simulate a successful checkout
  if (!stripe) {
    return res.json({
      mock: true,
      message: `Mock checkout for ${plan} plan. Set STRIPE_SECRET_KEY to enable real payments.`,
      mockUpgradeUrl: `/api/billing/mock-upgrade?plan=${plan}&userId=${req.user.id}`,
    })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: req.user.email,
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/pricing`,
      metadata: { userId: req.user.id, plan },
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('[billing] Checkout error:', err.message)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// ── Mock upgrade (dev only) ───────────────────────────────────────────────────
router.get('/mock-upgrade', requireAuth, (req, res) => {
  const { plan } = req.query
  if (!['pro', 'elite'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' })
  }
  updateUserTier(req.user.id, plan)
  res.json({ success: true, tier: plan, message: `Mock upgrade to ${plan} applied` })
})

// ── Customer portal (manage subscription) ────────────────────────────────────
router.post('/portal', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.json({ mock: true, message: 'Stripe not configured — no portal available in dev mode' })
  }

  if (!req.user.stripeId) {
    return res.status(400).json({ error: 'No active subscription found' })
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: req.user.stripeId,
      return_url: `${APP_URL}/account`,
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('[billing] Portal error:', err.message)
    res.status(500).json({ error: 'Failed to open billing portal' })
  }
})

// ── Stripe webhook ────────────────────────────────────────────────────────────
// Must be mounted with express.raw() — handled in index.js
export async function handleStripeWebhook(req, res) {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(200).json({ received: true, mock: true })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[billing] Webhook signature invalid:', err.message)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.userId
      const plan = session.metadata?.plan
      if (userId && plan) {
        updateUserTier(userId, plan)
        if (session.customer) updateStripeId(userId, session.customer)
        console.log(`[billing] Upgraded user ${userId} to ${plan}`)
      }
      break
    }

    case 'customer.subscription.deleted': {
      // Find user by stripeId and downgrade
      const customerId = event.data.object.customer
      const { db } = await import('../models/db.js')
      const user = db.prepare('SELECT * FROM users WHERE stripeId = ?').get(customerId)
      if (user) {
        updateUserTier(user.id, 'free')
        console.log(`[billing] Downgraded user ${user.id} to free (subscription cancelled)`)
      }
      break
    }

    case 'invoice.payment_failed': {
      console.warn('[billing] Payment failed for customer:', event.data.object.customer)
      break
    }
  }

  res.json({ received: true })
}

export default router
