const BASE = '/api'
const TOKEN_KEY = 'flexedge_token'

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

async function req(endpoint, opts = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  }
  const res = await fetch(`${BASE}${endpoint}`, { ...opts, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  health: () => req('/health'),

  lines: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return req(`/lines${qs ? `?${qs}` : ''}`)
    },
    top: (limit = 10) => req(`/lines/top?limit=${limit}`),
    get: (id) => req(`/lines/${id}`),
    statTypes: () => req('/lines/stat-types'),
  },

  // Authenticated per-user picks
  picks: {
    create: (data) => req('/user/picks', { method: 'POST', body: JSON.stringify(data) }),
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return req(`/user/picks${qs ? `?${qs}` : ''}`)
    },
    settle: (id, result) => req(`/user/picks/${id}/result`, { method: 'PUT', body: JSON.stringify({ result }) }),
    calibration: () => req('/user/picks/calibration'),
  },

  // Authenticated per-user bankroll
  bankroll: {
    get: () => req('/user/bankroll'),
    addEntry: (data) => req('/user/bankroll/entry', { method: 'POST', body: JSON.stringify(data) }),
  },

  alerts: {
    list: () => req('/alerts'),
    create: (data) => req('/alerts', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => req(`/alerts/${id}`, { method: 'DELETE' }),
  },

  calibration: () => req('/user/picks/calibration'),

  sharpSlate: (limit = 8) => req(`/sharp-slate?limit=${limit}`),
  dailySlip: () => req('/daily-slip'),
  lineAlerts: () => req('/line-alerts'),
  performance: () => req('/performance'),

  kelly: (data) => req('/kelly', { method: 'POST', body: JSON.stringify(data) }),
  correlationCheck: (picks) => req('/correlation-check', { method: 'POST', body: JSON.stringify({ picks }) }),
  player: (name) => req(`/player/${encodeURIComponent(name)}`),
  autoSlip: ({ type = 'power', picks = 5, minEV = 1 } = {}) =>
    req(`/auto-slip?type=${type}&picks=${picks}&minEV=${minEV}`),
  lineMovement: () => req('/line-movement'),
  refresh: () => req('/refresh', { method: 'POST' }),

  // Billing
  billing: {
    plans: () => req('/billing/plans'),
    checkout: (plan) => req('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
    mockUpgrade: (plan) => req(`/billing/mock-upgrade?plan=${plan}`),
    portal: () => req('/billing/portal', { method: 'POST' }),
  },

  // Push notifications
  push: {
    vapidKey: () => req('/push/vapid-public-key'),
    subscribe: (sub) => req('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),
    unsubscribe: (endpoint) => req('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  },
}

export default api
