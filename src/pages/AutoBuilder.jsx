import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Wand2, Zap, Umbrella, RefreshCw, ChevronRight,
  CheckCircle, TrendingUp, TrendingDown, Shield, AlertTriangle,
  Plus, RotateCcw,
} from 'lucide-react'
import { useStore } from '../store'
import { api } from '../api'
import { EVBadge, InjuryBadge, TrendBadge, LineValueBadge } from '../components/EVBadge'
import { clsx } from 'clsx'

const POWER_PAYOUTS = { 2: 3, 3: 5, 4: 10, 5: 20 }
const FLEX_PAYOUTS  = { 2: 3, 3: 2.25, 4: 5, 5: 10 }
const FLEX_INSURE   = { 3: 1.25, 4: 1.5, 5: 2 }

export default function AutoBuilder() {
  const addToSlip     = useStore(s => s.addToSlip)
  const slip          = useStore(s => s.slip)
  const clearSlip     = useStore(s => s.clearSlip)
  const setPlayType   = useStore(s => s.setPlayType)
  const lines         = useStore(s => s.lines)

  const [playType, setLocalPlayType]  = useState('power')
  const [pickCount, setPickCount]     = useState(5)
  const [minEV, setMinEV]             = useState(1)
  const [result, setResult]           = useState(null)
  const [loading, setLoading]         = useState(false)
  const [loadedAll, setLoadedAll]     = useState(false)

  // Auto-generate on first load if lines are available
  useEffect(() => {
    if (lines.length > 0 && !result) generate()
  }, [lines.length])

  async function generate() {
    setLoading(true)
    setLoadedAll(false)
    try {
      const data = await api.autoSlip({ type: playType, picks: pickCount, minEV })
      setResult(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function handlePlayTypeChange(t) {
    setLocalPlayType(t)
    setPlayType(t)  // sync to slip panel
    setResult(null)
  }

  function loadAllToSlip() {
    if (!result?.picks) return
    result.picks.forEach(pick => addToSlip(pick))
    setLoadedAll(true)
  }

  const entry = 25
  const n = result?.pickCount || pickCount
  const fullPayout   = (playType === 'power' ? POWER_PAYOUTS : FLEX_PAYOUTS)[n]
  const insurePayout = playType === 'flex' ? (FLEX_INSURE[n] ?? null) : null
  const allInSlip    = result?.picks?.every(p => slip.some(s => s.id === p.id))

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-5 h-5 text-brand-400" />
          <h2 className="text-lg font-bold text-white">Auto Slip Builder</h2>
        </div>
        <p className="text-sm text-slate-500">
          Picks the best combination for your slip — highest hit rate, no duplicate players, balanced across teams and stat types.
        </p>
      </div>

      {/* Controls */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4">

          {/* Play type */}
          <div>
            <p className="section-label mb-1.5">Play Type</p>
            <div className="flex rounded-lg border border-border-default overflow-hidden">
              <button
                onClick={() => handlePlayTypeChange('power')}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors',
                  playType === 'power' ? 'bg-brand-600 text-white' : 'bg-surface-base text-slate-500 hover:text-slate-300'
                )}
              >
                <Zap className="w-3.5 h-3.5" /> Power
              </button>
              <button
                onClick={() => handlePlayTypeChange('flex')}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors border-l border-border-default',
                  playType === 'flex' ? 'bg-ev-good/20 text-ev-good' : 'bg-surface-base text-slate-500 hover:text-slate-300'
                )}
              >
                <Umbrella className="w-3.5 h-3.5" /> Flex
              </button>
            </div>
          </div>

          {/* Pick count */}
          <div>
            <p className="section-label mb-1.5">Picks</p>
            <div className="flex gap-1">
              {[2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setPickCount(n)}
                  className={clsx(
                    'w-10 h-9 rounded-lg text-sm font-bold border transition-colors',
                    pickCount === n
                      ? 'bg-brand-600 text-white border-brand-500'
                      : 'bg-surface-base text-slate-500 border-border-default hover:text-slate-200'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Min EV */}
          <div>
            <p className="section-label mb-1.5">Min EV</p>
            <select
              value={minEV}
              onChange={e => setMinEV(parseFloat(e.target.value))}
              className="input text-xs h-9"
            >
              <option value={0}>Any EV</option>
              <option value={1}>+1 and up</option>
              <option value={3}>+3 and up</option>
              <option value={8}>+8 and up</option>
            </select>
          </div>

          <button
            onClick={generate}
            disabled={loading || lines.length === 0}
            className="btn btn-primary h-9 px-5 gap-2 ml-auto"
          >
            {loading
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Wand2 className="w-4 h-4" />}
            {loading ? 'Generating…' : 'Generate Slip'}
          </button>
        </div>

        {/* Payout preview */}
        {fullPayout && (
          <div className="mt-3 pt-3 border-t border-border-subtle flex flex-wrap gap-4 text-xs">
            <span className="text-slate-600">
              {pickCount}-pick {playType} ·&nbsp;
              <span className="text-ev-good font-mono font-bold">${entry} → ${(entry * fullPayout).toFixed(0)}</span>
              <span className="text-slate-600 ml-1">({fullPayout}x all hit)</span>
            </span>
            {insurePayout && (
              <span className="text-slate-600">
                <Umbrella className="w-3 h-3 inline text-warning mr-1" />
                Insurance: <span className="font-mono text-warning">${(entry * insurePayout).toFixed(0)}</span>
                <span className="text-slate-700 ml-1">({pickCount - 1}/{pickCount} hit)</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="card p-12 text-center">
          <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Scanning {lines.length} lines for optimal combinations…</p>
        </div>
      )}

      {/* Result slip */}
      {!loading && result && (
        <div className="space-y-4">

          {/* Slip header */}
          <div className="card p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={clsx(
                    'text-sm font-bold uppercase tracking-wide',
                    playType === 'power' ? 'text-brand-300' : 'text-ev-good'
                  )}>
                    {playType === 'power' ? '⚡ Power Play' : '☂ Flex Play'}
                  </span>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs text-slate-400">{result.pickCount} picks</span>
                  {result.fullPayout && (
                    <>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs font-mono text-ev-good">{result.fullPayout}x payout</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-slate-500">
                    Avg EV <span className={clsx('font-mono font-bold', result.avgEV >= 8 ? 'text-ev-strong' : result.avgEV >= 3 ? 'text-ev-good' : 'text-white')}>
                      {result.avgEV > 0 ? '+' : ''}{result.avgEV}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">
                    Avg Hit Rate <span className="font-mono font-bold text-white">{Math.round(result.avgHitRate * 100)}%</span>
                  </span>
                  {result.fullPayout && (
                    <span className="text-xs text-slate-500">
                      Win <span className="font-mono font-bold text-ev-good">${(entry * result.fullPayout).toFixed(0)}</span>
                      <span className="text-slate-600 ml-1">on ${entry}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={generate}
                  className="btn-ghost text-xs h-8 gap-1.5"
                  title="Regenerate"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={loadAllToSlip}
                  disabled={allInSlip}
                  className={clsx(
                    'btn text-sm h-9 gap-2',
                    allInSlip ? 'bg-ev-good/10 text-ev-good border border-ev-good/25' : 'btn-primary'
                  )}
                >
                  {allInSlip
                    ? <><CheckCircle className="w-4 h-4" /> All in Slip</>
                    : <><Plus className="w-4 h-4" /> Load All to Slip</>}
                </button>
              </div>
            </div>
          </div>

          {/* Picks */}
          <div className="space-y-3">
            {result.picks.map((pick, i) => (
              <PickCard key={pick.id} pick={pick} rank={i + 1} />
            ))}
          </div>

          {result.picks.length === 0 && (
            <div className="card p-8 text-center text-slate-500 text-sm">
              Not enough qualifying lines. Lower the min EV or check back when more games are scheduled.
            </div>
          )}

          {/* Transparency note */}
          <div className="card p-4 border-brand-500/10 bg-brand-500/5">
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-brand-300 mb-1">How this slip was built</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The model ranked all {lines.length} available lines by EV score, then selected the top {result.pickCount} with
                  zero duplicate players, max 1 teammate per team (Power) or 2 (Flex), and no more than 2 of the same
                  stat type. Hit rates are based on the last {result.picks[0]?.sampleSize || 20} games vs the current line.
                  All math is shown — no gut feelings, no hidden picks.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && lines.length === 0 && (
        <div className="card p-12 text-center text-slate-600 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-brand-500" />
          Connecting to data feed…
        </div>
      )}
    </div>
  )
}

// ── Pick Card ──────────────────────────────────────────────────────────────────
function PickCard({ pick, rank }) {
  const addToSlip = useStore(s => s.addToSlip)
  const slip      = useStore(s => s.slip)
  const inSlip    = slip.some(p => p.id === pick.id)
  const delta     = (pick.projection ?? pick.line) - pick.line

  const REC_BORDER = {
    STRONG: 'border-l-ev-strong',
    GOOD:   'border-l-ev-good',
    LEAN:   'border-l-warning',
    NEUTRAL:'border-l-slate-600',
    FADE:   'border-l-ev-fade',
    SKIP:   'border-l-ev-fade',
  }

  return (
    <div className={clsx(
      'card p-0 overflow-hidden border-l-4',
      REC_BORDER[pick.recommendation] || 'border-l-slate-600'
    )}>
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Rank */}
          <div className="w-7 h-7 rounded-full bg-surface-overlay flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="font-mono text-xs font-bold text-slate-400">{rank}</span>
          </div>

          {/* Avatar */}
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <span className="text-brand-400 font-mono font-bold text-sm">
              {pick.playerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/line/${pick.id}`}
                    className="text-sm font-bold text-white hover:text-brand-300 transition-colors"
                  >
                    {pick.playerName}
                  </Link>
                  <InjuryBadge status={pick.injury?.status} />
                  <TrendBadge trend={pick.trend} delta={pick.trendDelta} />
                  <LineValueBadge lineValue={pick.lineValue} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{pick.team} · {pick.position} · {pick.sport}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <EVBadge recommendation={pick.recommendation} evScore={pick.evScore} />
                <button
                  onClick={() => addToSlip(pick)}
                  disabled={inSlip}
                  className={clsx(
                    'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                    inSlip
                      ? 'bg-ev-good/20 text-ev-good cursor-default'
                      : 'bg-surface-overlay text-slate-500 hover:text-white hover:bg-brand-600'
                  )}
                >
                  <Plus className={clsx('w-3.5 h-3.5', inSlip && 'rotate-45')} />
                </button>
              </div>
            </div>

            {/* Stat line */}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600">{pick.statType}</span>
                <span className="font-mono text-sm font-bold text-white">O/U {pick.line}</span>
              </div>
              <span className={clsx('font-mono text-xs', delta > 0 ? 'text-ev-good' : 'text-ev-fade')}>
                proj {pick.projection?.toFixed(1)} ({delta > 0 ? '+' : ''}{delta.toFixed(1)})
              </span>
              <span className="font-mono text-xs text-slate-500">
                {Math.round((pick.hitRate || 0) * 100)}% hit · {pick.hitRateDisplay}
              </span>
              {pick.minutesToGame != null && (
                <span className="font-mono text-xs text-slate-600">
                  {pick.minutesToGame <= 0 ? 'LIVE' : pick.minutesToGame < 60 ? `${pick.minutesToGame}m` : `${Math.floor(pick.minutesToGame / 60)}h`}
                </span>
              )}
            </div>

            {/* Hit rate bar */}
            <div className="mt-2.5 mb-2">
              <div className="h-1 bg-surface-overlay rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    (pick.hitRate || 0) >= 0.65 ? 'bg-ev-good' :
                    (pick.hitRate || 0) >= 0.5  ? 'bg-warning' : 'bg-ev-fade'
                  )}
                  style={{ width: `${(pick.hitRate || 0) * 100}%` }}
                />
              </div>
            </div>

            {/* Reasoning */}
            {pick.reasoning && (
              <p className="text-xs text-slate-500 leading-relaxed bg-surface-base rounded-md px-2.5 py-1.5">
                {pick.reasoning}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
