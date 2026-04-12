const BASE = '/api'

async function req(endpoint, opts = {}) {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
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

  picks: {
    create: (data) => req('/picks', { method: 'POST', body: JSON.stringify(data) }),
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return req(`/picks${qs ? `?${qs}` : ''}`)
    },
    settle: (id, result) => req(`/picks/${id}/result`, { method: 'PUT', body: JSON.stringify({ result }) }),
  },

  bankroll: {
    get: () => req('/bankroll'),
    addEntry: (data) => req('/bankroll/entry', { method: 'POST', body: JSON.stringify(data) }),
  },

  alerts: {
    list: () => req('/alerts'),
    create: (data) => req('/alerts', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => req(`/alerts/${id}`, { method: 'DELETE' }),
  },

  calibration: () => req('/calibration'),

  sharpSlate: (limit = 8) => req(`/sharp-slate?limit=${limit}`),

  kelly: (data) => req('/kelly', { method: 'POST', body: JSON.stringify(data) }),

  correlationCheck: (picks) => req('/correlation-check', { method: 'POST', body: JSON.stringify({ picks }) }),

  player: (name) => req(`/player/${encodeURIComponent(name)}`),

  autoSlip: ({ type = 'power', picks = 5, minEV = 1 } = {}) =>
    req(`/auto-slip?type=${type}&picks=${picks}&minEV=${minEV}`),

  lineMovement: () => req('/line-movement'),

  refresh: () => req('/refresh', { method: 'POST' }),
}

export default api
