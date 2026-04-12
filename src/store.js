import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // ── Lines (from API) ────────────────────────────────────────────────────────
  lines: [],
  linesMeta: null,
  linesLoading: false,
  linesError: null,
  setLines: (lines, meta) => set({ lines, linesMeta: meta }),
  setLinesLoading: (v) => set({ linesLoading: v }),
  setLinesError: (v) => set({ linesError: v }),

  // ── Active picks (slip builder) ─────────────────────────────────────────────
  slip: [],        // picks added to current slip
  addToSlip: (line, direction = 'over') => set((s) => {
    const existing = s.slip.find(p => p.id === line.id)
    // Same direction again = remove (toggle off)
    if (existing && existing.direction === direction) return { slip: s.slip.filter(p => p.id !== line.id) }
    // Different direction = switch
    if (existing) return { slip: s.slip.map(p => p.id === line.id ? { ...p, direction } : p) }
    // New pick
    if (s.slip.length >= 5) return {}  // max 5 picks
    return { slip: [...s.slip, { ...line, direction }] }
  }),
  removeFromSlip: (id) => set((s) => ({ slip: s.slip.filter(p => p.id !== id) })),
  toggleDirection: (id) => set((s) => ({
    slip: s.slip.map(p => p.id === id ? { ...p, direction: p.direction === 'over' ? 'under' : 'over' } : p),
  })),
  clearSlip: () => set({ slip: [] }),

  // ── Play type ────────────────────────────────────────────────────────────────
  playType: 'power',  // 'power' | 'flex'
  setPlayType: (v) => set({ playType: v }),

  // ── Filters ─────────────────────────────────────────────────────────────────
  filters: {
    sport: 'NBA',
    statType: '',
    minEV: '',
    recommendation: '',
    search: '',
    sortBy: 'evScore',
  },
  setFilter: (key, val) => set((s) => ({ filters: { ...s.filters, [key]: val } })),
  resetFilters: () => set((s) => ({ filters: { ...s.filters, statType: '', minEV: '', recommendation: '', search: '' } })),

  // ── System status ────────────────────────────────────────────────────────────
  backendOnline: false,
  setBackendOnline: (v) => set({ backendOnline: v }),
  lastRefresh: null,
  setLastRefresh: (v) => set({ lastRefresh: v }),

  // ── Line alerts ───────────────────────────────────────────────────────────────
  lineAlerts: [],
  setLineAlerts: (alerts) => set({ lineAlerts: alerts }),
}))
