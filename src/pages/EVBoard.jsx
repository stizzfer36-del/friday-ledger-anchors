import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  SlidersHorizontal, X, Plus, ChevronUp, ChevronDown,
  AlertTriangle, Clock, TrendingUp, TrendingDown
} from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { useStore } from '../store'
import { EVBadge, InjuryBadge, ConfBadge, TrendBadge, LineValueBadge } from '../components/EVBadge'
import { clsx } from 'clsx'

const SORT_OPTIONS = [
  { value: 'evScore',   label: 'EV Score' },
  { value: 'hitRate',   label: 'Hit Rate' },
  { value: 'minutesToGame', label: 'Time to Game' },
]

const REC_FILTERS  = ['', 'STRONG', 'GOOD', 'LEAN', 'NEUTRAL', 'FADE']
const SPORT_TABS   = ['ALL', 'NBA', 'NFL', 'MLB', 'NHL']
const SPORT_COLOR  = {
  NBA: 'text-orange-400', NFL: 'text-blue-400',
  MLB: 'text-red-400',    NHL: 'text-sky-400',
}

export default function EVBoard() {
  const lines = useStore(s => s.lines)
  const filters = useStore(s => s.filters)
  const setFilter = useStore(s => s.setFilter)
  const resetFilters = useStore(s => s.resetFilters)
  const linesLoading = useStore(s => s.linesLoading)
  const addToSlip = useStore(s => s.addToSlip)
  const slip = useStore(s => s.slip)
  const meta = useStore(s => s.linesMeta)

  const [sortBy, setSortBy] = useState('evScore')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'
  const [activeSport, setActiveSport] = useState('ALL')

  // Unique stat types from current lines
  const statTypes = useMemo(() => {
    const types = [...new Set(lines.map(l => l.statType))].sort()
    return ['', ...types]
  }, [lines])

  const sportCounts = useMemo(() => {
    const counts = { ALL: lines.length }
    SPORT_TABS.slice(1).forEach(s => { counts[s] = lines.filter(l => l.sport === s).length })
    return counts
  }, [lines])

  const filtered = useMemo(() => {
    let result = [...lines]
    if (activeSport !== 'ALL') result = result.filter(l => l.sport === activeSport)

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(l =>
        l.playerName.toLowerCase().includes(q) ||
        l.team.toLowerCase().includes(q)
      )
    }
    if (filters.statType) result = result.filter(l => l.statType === filters.statType)
    if (filters.minEV)    result = result.filter(l => l.evScore >= parseFloat(filters.minEV))
    if (filters.recommendation) result = result.filter(l => l.recommendation === filters.recommendation)

    result.sort((a, b) => {
      if (sortBy === 'minutesToGame') return (a.minutesToGame ?? 9999) - (b.minutesToGame ?? 9999)
      if (sortBy === 'hitRate') return b.hitRate - a.hitRate
      return b.evScore - a.evScore
    })

    return result
  }, [lines, filters, sortBy])

  const hasFilters = filters.statType || filters.minEV || filters.recommendation || filters.search

  return (
    <div className="space-y-4 animate-fade-in max-w-7xl mx-auto">

      {/* Sport tabs */}
      <div className="flex items-center gap-1 border-b border-border-subtle -mb-2 pb-0">
        {SPORT_TABS.map(sport => {
          const count    = sportCounts[sport] ?? 0
          const isActive = activeSport === sport
          const tc       = SPORT_COLOR[sport]
          return (
            <button
              key={sport}
              onClick={() => setActiveSport(sport)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all border-b-2 -mb-px',
                isActive
                  ? sport === 'ALL' ? 'text-brand-400 border-brand-400' : `${tc} border-current`
                  : 'text-slate-600 border-transparent hover:text-slate-400'
              )}
            >
              {sport}
              {count > 0 && <span className="text-[10px] text-slate-700">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">EV Board</h2>
            <span className="font-mono text-xs text-slate-600 bg-surface-elevated px-2 py-0.5 rounded border border-border-subtle">
              {filtered.length} lines
            </span>
          </div>
          {meta?.lastRefresh?.lines && (
            <p className="text-xs text-slate-600 mt-0.5">
              Updated {formatAge(meta.lastRefresh.lines)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="input text-xs h-8 pr-6"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>Sort: {o.label}</option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex rounded-lg border border-border-default overflow-hidden">
            {['grid', 'table'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={clsx(
                  'px-3 h-8 text-xs font-medium transition-colors',
                  viewMode === mode
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-500 hover:text-slate-300 bg-surface-elevated'
                )}
              >
                {mode === 'grid' ? '⊞' : '☰'}
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'btn h-8 px-3 text-xs gap-1.5',
              showFilters || hasFilters ? 'btn-primary' : 'btn-outline'
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {hasFilters && <span className="w-1.5 h-1.5 bg-white rounded-full opacity-70" />}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="card p-4 animate-slide-up">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="section-label block mb-1.5">Stat Type</label>
              <select
                value={filters.statType}
                onChange={e => setFilter('statType', e.target.value)}
                className="input text-xs h-8"
              >
                {statTypes.map(t => (
                  <option key={t} value={t}>{t || 'All stats'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="section-label block mb-1.5">Min EV Score</label>
              <select
                value={filters.minEV}
                onChange={e => setFilter('minEV', e.target.value)}
                className="input text-xs h-8"
              >
                <option value="">Any EV</option>
                <option value="3">+3 and above</option>
                <option value="8">+8 and above</option>
                <option value="15">+15 and above</option>
              </select>
            </div>

            <div>
              <label className="section-label block mb-1.5">Signal</label>
              <div className="flex gap-1.5">
                {REC_FILTERS.map(r => (
                  <button
                    key={r}
                    onClick={() => setFilter('recommendation', r)}
                    className={clsx(
                      'px-2.5 h-8 rounded text-xs font-medium transition-colors border',
                      filters.recommendation === r
                        ? 'bg-brand-600 text-white border-brand-500'
                        : 'border-border-default text-slate-500 hover:text-slate-300'
                    )}
                  >
                    {r || 'All'}
                  </button>
                ))}
              </div>
            </div>

            {hasFilters && (
              <button onClick={resetFilters} className="btn-ghost text-xs h-8 gap-1.5 text-slate-500">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {linesLoading && lines.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-600">Loading lines…</p>
          </div>
        </div>
      )}

      {/* Grid view */}
      {!linesLoading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(line => (
            <EVCard key={line.id} line={line} />
          ))}
        </div>
      )}

      {/* Table view */}
      {!linesLoading && viewMode === 'table' && (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Stat / Line</th>
                <th className="text-right">Proj</th>
                <th className="text-right">Hit Rate</th>
                <th className="text-right">EV</th>
                <th className="text-right">Signal</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(line => (
                <TableRow key={line.id} line={line} />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-600">No lines match your filters</div>
          )}
        </div>
      )}

      {!linesLoading && filtered.length === 0 && lines.length > 0 && (
        <div className="py-16 text-center">
          <p className="text-slate-500 text-sm">No lines match your filters</p>
          <button onClick={resetFilters} className="btn-ghost text-xs mt-2">Clear filters</button>
        </div>
      )}
    </div>
  )
}

// ── EV Card ───────────────────────────────────────────────────────────────────
function EVCard({ line }) {
  const addToSlip  = useStore(s => s.addToSlip)
  const slip       = useStore(s => s.slip)
  const navigate   = useNavigate()
  const inSlip     = slip.some(p => p.id === line.id)

  const projectionDelta = line.projection - line.line
  const sparkData = (line.recentGames || []).map((g, i) => ({ i, v: g.statValue }))

  return (
    <div
      onClick={() => navigate(`/line/${encodeURIComponent(line.id)}`)}
      className={clsx(
        'card p-4 transition-all group relative overflow-hidden cursor-pointer',
        inSlip ? 'border-ev-good/40 shadow-ev' : 'hover:border-border-bright hover:shadow-card-hover',
        line.recommendation === 'STRONG' && !inSlip && 'border-ev-strong/20'
      )}
    >
      {/* Top stripe for STRONG */}
      {line.recommendation === 'STRONG' && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ev-strong/60 to-transparent" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <span className="text-brand-400 font-mono font-bold text-xs">
              {line.playerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{line.playerName}</p>
            <p className="text-xs text-slate-600">{line.team} · {line.position}</p>
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); addToSlip(line) }}
          disabled={inSlip}
          className={clsx(
            'w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
            inSlip
              ? 'bg-ev-good/20 text-ev-good cursor-default'
              : 'bg-surface-overlay text-slate-600 hover:text-white hover:bg-brand-600'
          )}
        >
          <Plus className={clsx('w-3.5 h-3.5', inSlip && 'rotate-45')} />
        </button>
      </div>

      {/* Stat + Line */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500">{line.statType}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-600">O/U</span>
          <span className="font-mono text-base font-bold text-white">{line.line}</span>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Metric label="Projected" value={line.projection?.toFixed(1)} color={projectionDelta > 0 ? 'text-ev-good' : 'text-ev-fade'} />
        <Metric label="Edge" value={`${projectionDelta > 0 ? '+' : ''}${projectionDelta?.toFixed(1)}`} color={projectionDelta > 0 ? 'text-ev-good' : 'text-ev-fade'} />
        <Metric label="Hit Rate" value={`${(line.hitRate * 100).toFixed(0)}%`} sub={line.hitRateDisplay} />
      </div>

      {/* Hit rate bar */}
      <div className="mb-3">
        <div className="hit-bar-track">
          <div
            className={clsx('hit-bar-fill', line.hitRate >= 0.6 ? 'bg-ev-good' : line.hitRate >= 0.5 ? 'bg-warning' : 'bg-ev-fade')}
            style={{ width: `${line.hitRate * 100}%` }}
          />
        </div>
      </div>

      {/* Mini sparkline of recent games */}
      {sparkData.length > 0 && (
        <div className="h-8 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={line.hitRate >= 0.55 ? '#10E890' : '#F43F5E'}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <EVBadge recommendation={line.recommendation} evScore={line.evScore} />
          <TrendBadge trend={line.trend} delta={line.trendDelta} />
          <LineValueBadge lineValue={line.lineValue} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <InjuryBadge status={line.injury?.status} />
          {/* Line movement */}
          {line.lineMovement?.delta != null && line.lineMovement.delta !== 0 && (
            <span className={clsx(
              'text-xs font-mono flex items-center gap-0.5',
              line.lineMovement.direction === 'down' ? 'text-ev-good' : 'text-ev-fade'
            )} title={`Line moved ${line.lineMovement.direction === 'up' ? '▲' : '▼'}${Math.abs(line.lineMovement.delta)}`}>
              {line.lineMovement.direction === 'down'
                ? <TrendingDown className="w-3 h-3" />
                : <TrendingUp className="w-3 h-3" />}
              {Math.abs(line.lineMovement.delta).toFixed(1)}
            </span>
          )}
          {line.isStale && (
            <span className="text-xs text-stale flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" /> stale
            </span>
          )}
          {line.minutesToGame != null && (
            <span className="text-xs text-slate-600 flex items-center gap-0.5 font-mono">
              <Clock className="w-2.5 h-2.5" /> {formatMinutes(line.minutesToGame)}
            </span>
          )}
        </div>
      </div>

      {/* Reasoning */}
      {line.reasoning && (
        <p className="text-[10px] text-slate-600 leading-relaxed mt-2 pt-2 border-t border-border-subtle">
          {line.reasoning}
        </p>
      )}
    </div>
  )
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function TableRow({ line }) {
  const addToSlip = useStore(s => s.addToSlip)
  const slip      = useStore(s => s.slip)
  const navigate  = useNavigate()
  const inSlip    = slip.some(p => p.id === line.id)
  const delta     = line.projection - line.line

  return (
    <tr
      onClick={() => navigate(`/line/${encodeURIComponent(line.id)}`)}
      className={clsx('cursor-pointer hover:bg-surface-elevated/60 transition-colors', inSlip && 'bg-ev-good/5')}
    >
      <td>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <span className="text-brand-400 font-mono font-bold text-[10px]">
              {line.playerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">{line.playerName}</p>
            <p className="text-xs text-slate-600">{line.team}</p>
          </div>
        </div>
      </td>
      <td>
        <p className="text-sm text-slate-300">{line.statType}</p>
        <p className="font-mono text-xs text-slate-600">O/U {line.line}</p>
      </td>
      <td className="text-right">
        <span className={clsx('font-mono text-sm', delta > 0 ? 'text-ev-good' : 'text-ev-fade')}>
          {line.projection?.toFixed(1)}
        </span>
        <p className={clsx('font-mono text-xs', delta > 0 ? 'text-ev-good/60' : 'text-ev-fade/60')}>
          {delta > 0 ? '+' : ''}{delta?.toFixed(1)}
        </p>
      </td>
      <td className="text-right">
        <span className="font-mono text-sm text-white">{(line.hitRate * 100).toFixed(0)}%</span>
        <p className="font-mono text-xs text-slate-600">{line.hitRateDisplay}</p>
      </td>
      <td className="text-right">
        <span className={clsx(
          'font-mono text-sm font-bold',
          line.evScore >= 10 ? 'text-ev-strong' : line.evScore >= 3 ? 'text-ev-good' : line.evScore >= 0 ? 'text-slate-400' : 'text-ev-fade'
        )}>
          {line.evScore > 0 ? '+' : ''}{line.evScore}
        </span>
      </td>
      <td className="text-right">
        <EVBadge recommendation={line.recommendation} />
      </td>
      <td>
        <InjuryBadge status={line.injury?.status} />
      </td>
      <td>
        <button
          onClick={(e) => { e.stopPropagation(); addToSlip(line) }}
          disabled={inSlip}
          className={clsx(
            'w-6 h-6 rounded flex items-center justify-center transition-all',
            inSlip ? 'text-ev-good cursor-default' : 'text-slate-600 hover:text-white hover:bg-brand-600'
          )}
        >
          <Plus className={clsx('w-3.5 h-3.5', inSlip && 'rotate-45')} />
        </button>
      </td>
    </tr>
  )
}

function Metric({ label, value, sub, color }) {
  return (
    <div className="bg-surface-base rounded-md px-2 py-1.5">
      <p className="text-[10px] text-slate-600 mb-0.5">{label}</p>
      <p className={clsx('font-mono text-sm font-semibold', color || 'text-white')}>{value ?? '—'}</p>
      {sub && <p className="text-[10px] text-slate-700 font-mono">{sub}</p>}
    </div>
  )
}

function formatAge(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

function formatMinutes(mins) {
  if (mins <= 0) return 'LIVE'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
