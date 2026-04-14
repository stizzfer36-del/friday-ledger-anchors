import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { api } from '../api'
import { TrendBadge } from '../components/EVBadge'
import { Star, ChevronRight, Zap, TrendingUp, Activity, RotateCcw } from 'lucide-react'
import { clsx } from 'clsx'

const SPORT_TABS = ['All', 'NBA', 'NFL', 'MLB', 'NHL']
const SPORT_DOT  = { NBA: 'bg-orange-400', NFL: 'bg-blue-400', MLB: 'bg-red-400', NHL: 'bg-sky-400' }
const REC_ORDER  = { STRONG: 0, GOOD: 1, LEAN: 2, NEUTRAL: 3, FADE: 4, SKIP: 5 }

export default function Dashboard() {
  const lines        = useStore(s => s.lines)
  const linesLoading = useStore(s => s.linesLoading)
  const addToSlip    = useStore(s => s.addToSlip)
  const slip         = useStore(s => s.slip)
  const filters      = useStore(s => s.filters)

  const [sport,    setSport]    = useState('All')
  const [view,     setView]     = useState('all')   // 'all' | 'best'
  const [autoSlip, setAutoSlip] = useState(null)

  // Fetch auto slip once lines load
  useEffect(() => {
    if (lines.length > 0) {
      api.autoSlip({ type: 'power', picks: 5, minEV: 1 })
        .then(setAutoSlip).catch(() => {})
    }
  }, [lines.length])

  // Sport counts
  const sportCounts = useMemo(() => {
    const c = {}
    SPORT_TABS.slice(1).forEach(s => { c[s] = lines.filter(l => l.sport === s).length })
    return c
  }, [lines])

  // Filtered + sorted picks
  const visibleLines = useMemo(() => {
    let list = lines
    if (sport !== 'All') list = list.filter(l => l.sport === sport)
    if (view === 'best')  list = list.filter(l => l.recommendation === 'STRONG' || l.recommendation === 'GOOD')
    if (filters.search)   list = list.filter(l =>
      l.playerName.toLowerCase().includes(filters.search.toLowerCase()) ||
      l.team.toLowerCase().includes(filters.search.toLowerCase())
    )
    return [...list].sort((a, b) => {
      const ao = REC_ORDER[a.recommendation] ?? 9
      const bo = REC_ORDER[b.recommendation] ?? 9
      if (ao !== bo) return ao - bo
      return (b.evScore || 0) - (a.evScore || 0)
    })
  }, [lines, sport, view, filters.search])

  const slipIds = new Set(slip.map(s => s.id))

  return (
    <div className="flex gap-5 h-full min-w-0">

      {/* ── Left: card lobby ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Sport tabs + filter toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-1 overflow-x-auto scrollbar-none">
            {SPORT_TABS.map(s => {
              const active = sport === s
              const dot    = SPORT_DOT[s]
              return (
                <button
                  key={s}
                  onClick={() => setSport(s)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                    active ? 'bg-surface-overlay text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                  )}
                >
                  {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />}
                  {s}
                  {s !== 'All' && sportCounts[s] > 0 && (
                    <span className={clsx('text-[10px]', active ? 'text-slate-400' : 'text-slate-700')}>
                      {sportCounts[s]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-1">
            <button
              onClick={() => setView('all')}
              className={clsx('px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                view === 'all' ? 'bg-surface-overlay text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              All Picks
            </button>
            <button
              onClick={() => setView('best')}
              className={clsx('px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                view === 'best' ? 'bg-surface-overlay text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              🔥 Best Picks
            </button>
          </div>
        </div>

        {/* Card grid */}
        {linesLoading && lines.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-48 animate-pulse bg-surface-elevated" />
            ))}
          </div>
        ) : visibleLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <p className="text-sm">No picks match this filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleLines.map(line => (
              <PickCard
                key={line.id}
                line={line}
                slipPick={slip.find(s => s.id === line.id)}
                onPick={(dir) => addToSlip(line, dir)}
                slipFull={slip.length >= 5 && !slipIds.has(line.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Right: Auto slip sidebar ──────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 hidden xl:block">
        <AutoSlipSidebar autoSlip={autoSlip} onRefresh={() =>
          api.autoSlip({ type: 'power', picks: 5, minEV: 1 }).then(setAutoSlip).catch(() => {})
        } />
      </div>
    </div>
  )
}

// ── Pick Card ─────────────────────────────────────────────────────────────────
function PickCard({ line, slipPick, onPick, slipFull }) {
  const navigate = useNavigate()
  const hitPct  = line.hitRate != null ? Math.round(line.hitRate * 100) : null
  const isHot   = line.trend === 'hot'
  const isStrong = line.recommendation === 'STRONG' || line.recommendation === 'GOOD'
  const dot     = SPORT_DOT[line.sport] || 'bg-slate-500'

  const gameTime = line.startTime
    ? new Date(line.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null

  const moreActive = slipPick?.direction === 'over'
  const lessActive = slipPick?.direction === 'under'
  const inSlip     = moreActive || lessActive

  return (
    <div
      onClick={() => navigate(`/line/${encodeURIComponent(line.id)}`)}
      className={clsx(
        'card flex flex-col overflow-hidden transition-all duration-150 cursor-pointer',
        inSlip ? 'ring-1 ring-brand-500/60' : 'hover:border-border-bright'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{line.sport}</span>
          {gameTime && <span className="text-[10px] text-slate-700">{gameTime}</span>}
        </div>
        <div className="flex items-center gap-1">
          {isHot && <span className="text-sm" title="Hot streak — trending up">🔥</span>}
          {isStrong && !isHot && (
            <span className="text-[10px] font-bold text-ev-good px-1.5 py-0.5 rounded bg-ev-good/10 border border-ev-good/20">TOP</span>
          )}
        </div>
      </div>

      {/* Player */}
      <div className="px-3 pb-2 flex-1">
        <p className="text-sm font-bold text-white leading-tight">{line.playerName}</p>
        <p className="text-xs text-slate-500 mt-0.5">{line.team} · {line.statType}</p>
      </div>

      {/* Line number */}
      <div className="px-3 py-2 text-center">
        <p className="text-3xl font-black text-white font-mono leading-none">{line.line}</p>
        {hitPct != null && (
          <p className="text-[10px] text-slate-600 mt-1">Hit {hitPct}% · last 20</p>
        )}
      </div>

      {/* More / Less buttons */}
      <div className="flex border-t border-border-subtle">
        <button
          onClick={(e) => { e.stopPropagation(); !slipFull && onPick('over') }}
          disabled={slipFull && !inSlip}
          className={clsx(
            'flex-1 py-3 text-sm font-bold transition-all',
            moreActive
              ? 'bg-emerald-500/20 text-emerald-400'
              : slipFull
                ? 'text-slate-700 cursor-not-allowed'
                : 'text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400'
          )}
        >
          ↑ More
        </button>
        <div className="w-px bg-border-subtle" />
        <button
          onClick={(e) => { e.stopPropagation(); !slipFull && onPick('under') }}
          disabled={slipFull && !inSlip}
          className={clsx(
            'flex-1 py-3 text-sm font-bold transition-all',
            lessActive
              ? 'bg-sky-500/20 text-sky-400'
              : slipFull
                ? 'text-slate-700 cursor-not-allowed'
                : 'text-slate-400 hover:bg-sky-500/10 hover:text-sky-400'
          )}
        >
          ↓ Less
        </button>
      </div>
    </div>
  )
}

// ── Auto slip sidebar ─────────────────────────────────────────────────────────
function AutoSlipSidebar({ autoSlip, onRefresh }) {
  const slip      = useStore(s => s.slip)
  const addToSlip = useStore(s => s.addToSlip)

  const POWER_PAYOUTS = { 2: 3, 3: 5, 4: 10, 5: 20 }

  if (!autoSlip) {
    return (
      <div className="card p-4 sticky top-0">
        <p className="section-label mb-3">Best Slip</p>
        <div className="flex flex-col items-center py-8 text-slate-700">
          <Star className="w-6 h-6 mb-2 opacity-40" />
          <p className="text-xs text-center">Building your best slip…</p>
        </div>
      </div>
    )
  }

  const inSlipIds = new Set(slip.map(s => s.id))
  const allAdded  = autoSlip.picks?.every(p => inSlipIds.has(p.id))
  const payout    = POWER_PAYOUTS[autoSlip.pickCount] || 20

  return (
    <div className="card sticky top-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-white">Best Slip</p>
          <p className="text-xs text-slate-600">Auto-built · Power · {autoSlip.pickCount} picks</p>
        </div>
        <button onClick={onRefresh} className="text-slate-600 hover:text-slate-300 transition-colors p-1" title="Rebuild">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-border-subtle grid grid-cols-2 gap-x-4 gap-y-1">
        <div>
          <p className="text-[10px] text-slate-600">Avg Hit Rate</p>
          <p className="font-mono text-sm font-bold text-white">{autoSlip.avgHitRate != null ? `${Math.round(autoSlip.avgHitRate * 100)}%` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-600">Payout</p>
          <p className="font-mono text-sm font-bold text-emerald-400">{payout}×</p>
        </div>
      </div>

      {/* Picks */}
      <div className="divide-y divide-border-subtle/50">
        {autoSlip.picks?.map((pick, i) => {
          const added = inSlipIds.has(pick.id)
          const dot   = SPORT_DOT[pick.sport] || 'bg-slate-500'
          return (
            <div
              key={pick.id}
              onClick={() => !added && addToSlip(pick, 'over')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors',
                added ? 'bg-brand-600/10' : 'hover:bg-surface-elevated'
              )}
            >
              <span className="w-4 h-4 rounded-full bg-surface-overlay text-[10px] font-bold text-slate-500 flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />
                  <p className="text-xs font-semibold text-white truncate">{pick.playerName}</p>
                </div>
                <p className="text-[10px] text-slate-500 truncate ml-3">
                  {pick.statType} · ↑ {pick.line}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <TrendBadge trend={pick.trend} compact />
                {added
                  ? <span className="text-[10px] text-brand-400 font-bold">✓</span>
                  : <span className="text-[10px] text-slate-600">+</span>
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* Load all */}
      <div className="px-4 py-3 border-t border-border-subtle">
        {!allAdded ? (
          <button
            onClick={() => autoSlip.picks?.forEach(p => addToSlip(p, 'over'))}
            className="btn-primary w-full text-xs py-2 gap-1.5"
          >
            <Star className="w-3.5 h-3.5" /> Load All to Slip
          </button>
        ) : (
          <p className="text-center text-xs text-brand-400 py-1 flex items-center justify-center gap-1.5">
            <span>✓</span> All picks added
          </p>
        )}

        <div className="mt-3 space-y-1">
          <Link to="/builder" className="flex items-center justify-between text-xs text-slate-500 hover:text-slate-300 py-1 group transition-colors">
            <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-brand-400" />Auto Builder</span>
            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <Link to="/board" className="flex items-center justify-between text-xs text-slate-500 hover:text-slate-300 py-1 group transition-colors">
            <span className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3 text-ev-good" />EV Board</span>
            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <Link to="/entries" className="flex items-center justify-between text-xs text-slate-500 hover:text-slate-300 py-1 group transition-colors">
            <span className="flex items-center gap-1.5"><Activity className="w-3 h-3 text-ev-lean" />My Entries</span>
            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>
      </div>
    </div>
  )
}
