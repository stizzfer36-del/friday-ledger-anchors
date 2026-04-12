import { useState, useEffect } from 'react'
import { X, Trash2, Zap, Umbrella, CheckCircle, AlertTriangle, Calculator, Shield } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../api'
import { clsx } from 'clsx'

const POWER_PAYOUTS = { 2: 3, 3: 5, 4: 10, 5: 20 }
const FLEX_ALL_HIT  = { 2: 3, 3: 2.25, 4: 5, 5: 10 }
const FLEX_ONE_MISS = { 2: null, 3: 1.25, 4: 1.5, 5: 2 }

export default function SlipPanel() {
  const slip            = useStore(s => s.slip)
  const removeFromSlip  = useStore(s => s.removeFromSlip)
  const toggleDirection = useStore(s => s.toggleDirection)
  const clearSlip       = useStore(s => s.clearSlip)
  const playType        = useStore(s => s.playType)
  const setPlayType     = useStore(s => s.setPlayType)

  const [entry,       setEntry]       = useState('25')
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [correlation, setCorrelation] = useState(null)
  const [kellyData,   setKellyData]   = useState(null)
  const [showKelly,   setShowKelly]   = useState(false)

  const n           = Math.min(slip.length, 5)
  const avgHitRate  = slip.length > 0 ? slip.reduce((s, p) => s + (p.hitRate || 0.5), 0) / slip.length : 0.5
  const fullPayout  = playType === 'power' ? (POWER_PAYOUTS[n] ?? null) : (FLEX_ALL_HIT[n] ?? null)
  const insurePayout = playType === 'flex' ? (FLEX_ONE_MISS[n] ?? null) : null
  const dollars     = parseFloat(entry) || 25
  const winAmount   = fullPayout   ? (dollars * fullPayout).toFixed(2)   : null
  const insureAmount = insurePayout ? (dollars * insurePayout).toFixed(2) : null

  // Correlation check
  useEffect(() => {
    if (slip.length >= 2) {
      api.correlationCheck(slip.map(p => ({ playerName: p.playerName, team: p.team, statType: p.statType })))
        .then(setCorrelation).catch(() => setCorrelation(null))
    } else {
      setCorrelation(null)
    }
  }, [slip.map(p => p.id).join(',')])

  // Kelly sizing
  useEffect(() => {
    if (slip.length > 0 && entry) {
      const payout = (playType === 'power' ? POWER_PAYOUTS : FLEX_ALL_HIT)[n] || 3
      api.kelly({
        hitRate: avgHitRate,
        payoutMultiplier: payout,
        bankroll: (parseFloat(entry) || 25) * 10,
        fraction: 0.25,
      }).then(setKellyData).catch(() => setKellyData(null))
    }
  }, [slip.length, entry, avgHitRate.toFixed(3), playType])

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all(slip.map(pick =>
        api.picks.create({
          lineId: pick.id,
          playerName: pick.playerName,
          team: pick.team,
          statType: pick.statType,
          line: pick.line,
          projection: pick.projection,
          evScore: pick.evScore,
          hitRate: pick.hitRate,
          recommendation: pick.recommendation,
          sport: pick.sport,
          direction: pick.direction,
          playType,
          entryAmount: parseFloat(entry) / slip.length,
        })
      ))
      setSaved(true)
      setTimeout(() => { clearSlip(); setSaved(false) }, 1400)
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  const riskColor = { CLEAN: 'text-positive', LOW: 'text-warning', MEDIUM: 'text-stale', HIGH: 'text-ev-fade' }

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-l border-border-subtle bg-surface-raised overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <p className="text-sm font-bold text-white">
          My Slip&nbsp;
          <span className="text-brand-400">{slip.length}</span>
          <span className="text-slate-600 font-normal text-xs">/{5}</span>
        </p>
        <button onClick={clearSlip} className="text-slate-600 hover:text-slate-300 transition-colors p-1">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Power / Flex toggle */}
      <div className="px-3 py-2.5 border-b border-border-subtle">
        <div className="flex rounded-lg border border-border-default overflow-hidden">
          <button
            onClick={() => setPlayType('power')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors',
              playType === 'power' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Zap className="w-3 h-3" /> Power
          </button>
          <button
            onClick={() => setPlayType('flex')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors border-l border-border-default',
              playType === 'flex' ? 'bg-emerald-600/30 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Umbrella className="w-3 h-3" /> Flex
          </button>
        </div>

        {/* Payout preview */}
        {n >= 2 && fullPayout && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">All {n} hit</span>
              <span className="font-mono text-xs font-bold text-emerald-400">${winAmount} ({fullPayout}×)</span>
            </div>
            {insureAmount && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  <Umbrella className="w-2.5 h-2.5" /> {n - 1}/{n} hit
                </span>
                <span className="font-mono text-xs text-slate-400">${insureAmount} ({insurePayout}×)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Correlation warning */}
      {correlation && !correlation.isClean && (
        <div className={clsx('px-3 py-2.5 border-b border-border-subtle', correlation.riskLevel === 'HIGH' ? 'bg-ev-fade/5' : 'bg-warning/5')}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className={clsx('w-3.5 h-3.5', riskColor[correlation.riskLevel])} />
            <span className={clsx('text-xs font-semibold', riskColor[correlation.riskLevel])}>
              {correlation.riskLevel} CORRELATION
            </span>
          </div>
          {correlation.warnings.map((w, i) => (
            <p key={i} className="text-xs text-slate-500 leading-relaxed">{w.message}</p>
          ))}
        </div>
      )}
      {correlation?.isClean && slip.length >= 2 && (
        <div className="px-3 py-2 border-b border-border-subtle bg-positive/5 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-positive" />
          <span className="text-xs text-positive font-medium">No correlation risk</span>
        </div>
      )}

      {/* Picks list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {slip.map(pick => {
          const isMore = pick.direction === 'over'
          return (
            <div key={pick.id} className="card overflow-hidden">
              <div className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{pick.playerName}</p>
                    <p className="text-[10px] text-slate-500">{pick.team} · {pick.statType}</p>
                  </div>
                  <button onClick={() => removeFromSlip(pick.id)} className="text-slate-700 hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {/* Direction toggle */}
                <div className="flex rounded-md overflow-hidden border border-border-default mt-2">
                  <button
                    onClick={() => toggleDirection(pick.id)}
                    className={clsx(
                      'flex-1 py-1.5 text-xs font-bold transition-colors',
                      isMore ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-600 hover:text-slate-400'
                    )}
                  >
                    ↑ More {pick.line}
                  </button>
                  <button
                    onClick={() => toggleDirection(pick.id)}
                    className={clsx(
                      'flex-1 py-1.5 text-xs font-bold transition-colors border-l border-border-default',
                      !isMore ? 'bg-sky-500/15 text-sky-400' : 'text-slate-600 hover:text-slate-400'
                    )}
                  >
                    ↓ Less {pick.line}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {slip.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-6">Tap More or Less on any pick</p>
        )}
      </div>

      {/* Kelly + footer */}
      <div className="px-3 py-3 border-t border-border-subtle space-y-2.5">

        {/* Kelly toggle */}
        <button
          onClick={() => setShowKelly(!showKelly)}
          className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-300 transition-colors py-0.5"
        >
          <span className="flex items-center gap-1.5"><Calculator className="w-3.5 h-3.5" /> Sizing Calculator</span>
          <span className="text-[10px] text-brand-400">{showKelly ? 'hide' : 'show'}</span>
        </button>

        {showKelly && kellyData && (
          <div className="bg-surface-base rounded-lg p-3 space-y-1.5 border border-border-subtle animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Edge vs break-even</span>
              <span className={clsx('font-mono text-xs font-bold', kellyData.edge >= 0 ? 'text-ev-good' : 'text-ev-fade')}>
                {kellyData.edge >= 0 ? '+' : ''}{kellyData.edge}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">¼-Kelly rec. bet</span>
              <span className="font-mono text-xs font-bold text-brand-400">${kellyData.recommendedBet.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Break-even hit%</span>
              <span className="font-mono text-xs text-slate-400">{(kellyData.breakEvenHitRate * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 flex-shrink-0">Entry $</label>
          <input
            type="number"
            value={entry}
            onChange={e => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) setEntry(v) }}
            className="input flex-1 text-xs h-8 font-mono"
            min="1"
            step="5"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || saved || slip.length < 2}
          className={clsx(
            'w-full btn text-sm h-9 font-bold',
            saved
              ? 'bg-positive/10 text-positive border border-positive/25'
              : slip.length < 2
                ? 'bg-surface-elevated text-slate-600 cursor-not-allowed'
                : 'btn-primary'
          )}
        >
          {saved ? (
            <><CheckCircle className="w-4 h-4" /> Locked In!</>
          ) : saving ? 'Saving…' : (
            slip.length < 2
              ? `Add ${2 - slip.length} more pick${slip.length === 1 ? '' : 's'}`
              : `Lock In ${slip.length} Pick${slip.length !== 1 ? 's' : ''}`
          )}
        </button>
      </div>
    </aside>
  )
}
