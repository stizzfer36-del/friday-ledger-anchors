import { useState, useEffect } from 'react'
import { Shield, BarChart2, TrendingUp, Award, AlertCircle } from 'lucide-react'
import { api } from '../api'
import { clsx } from 'clsx'

export default function Performance() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.performance()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-slate-500 text-sm">Loading track record…</div>
      </div>
    )
  }

  if (!data?.summary) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <BarChart2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h2 className="font-bold text-white text-lg mb-2">Track Record Builds Over Time</h2>
        <p className="text-slate-500 text-sm">
          As users log picks and results auto-settle, this page shows the model's verified hit rate
          by sport, stat type, and recommendation level.
        </p>
        <p className="text-slate-600 text-xs mt-3">No settled picks yet. Start logging picks to build the record.</p>
      </div>
    )
  }

  const { summary, byRecommendation, bySport, byStatType } = data

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Model Track Record</h1>
          <p className="text-slate-500 text-xs">
            Auto-settled via ESPN. Public. Uneditable. Updated {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : 'live'}.
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400/80">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        Results are aggregate across all user picks. Individual results vary. Past performance does not guarantee future results.
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Overall Hit Rate"
          value={`${(summary.hitRate * 100).toFixed(1)}%`}
          sub={`${summary.picks} picks`}
          color={summary.hitRate >= 0.55 ? 'text-positive' : summary.hitRate >= 0.5 ? 'text-white' : 'text-negative'}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Wins"
          value={summary.hits}
          sub={`of ${summary.picks} tracked`}
          color="text-positive"
        />
        <MetricCard
          label="Edge vs 50%"
          value={`${summary.hitRate >= 0.5 ? '+' : ''}${((summary.hitRate - 0.5) * 100).toFixed(1)}%`}
          sub="above break-even"
          color={summary.hitRate >= 0.5 ? 'text-positive' : 'text-negative'}
        />
        <MetricCard
          label="Average Capper"
          value="~52%"
          sub="industry baseline"
          color="text-slate-400"
        />
      </div>

      {/* By recommendation */}
      {Object.keys(byRecommendation).length > 0 && (
        <Section title="By Signal" icon={<Award className="w-4 h-4 text-brand-400" />}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {['STRONG', 'GOOD', 'LEAN', 'NEUTRAL', 'FADE'].map(rec => {
              const d = byRecommendation[rec]
              if (!d) return null
              return (
                <div key={rec} className="bg-surface-elevated rounded-xl p-4">
                  <div className={clsx('text-xs font-bold mb-2 px-2 py-0.5 rounded inline-block', {
                    'text-ev-strong bg-ev-strong/10': rec === 'STRONG',
                    'text-ev-good bg-ev-good/10': rec === 'GOOD',
                    'text-ev-lean bg-ev-lean/10': rec === 'LEAN',
                    'text-slate-400 bg-slate-400/10': rec === 'NEUTRAL',
                    'text-negative bg-negative/10': rec === 'FADE',
                  })}>
                    {rec}
                  </div>
                  <p className={clsx('text-2xl font-bold font-mono', {
                    'text-positive': d.hitRate >= 0.55,
                    'text-white': d.hitRate >= 0.5 && d.hitRate < 0.55,
                    'text-negative': d.hitRate < 0.5,
                  })}>
                    {(d.hitRate * 100).toFixed(1)}%
                  </p>
                  <HitRateBar rate={d.hitRate} />
                  <p className="text-xs text-slate-600 mt-1">{d.n} picks · {d.hits} hits</p>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* By sport */}
      {Object.keys(bySport).length > 0 && (
        <Section title="By Sport">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(bySport).sort((a, b) => b[1].n - a[1].n).map(([sport, d]) => (
              <div key={sport} className="bg-surface-elevated rounded-xl p-4 text-center">
                <p className="text-slate-400 text-sm font-bold mb-1">{sport}</p>
                <p className={clsx('text-2xl font-bold font-mono', {
                  'text-positive': d.hitRate >= 0.55,
                  'text-white': d.hitRate >= 0.5 && d.hitRate < 0.55,
                  'text-negative': d.hitRate < 0.5,
                })}>
                  {(d.hitRate * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-600">{d.n} picks</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* By stat type */}
      {Object.keys(byStatType).length > 0 && (
        <Section title="By Stat Type">
          <div className="space-y-2">
            {Object.entries(byStatType)
              .sort((a, b) => b[1].n - a[1].n)
              .slice(0, 12)
              .map(([stat, d]) => (
                <div key={stat} className="flex items-center gap-3 p-2 rounded-lg bg-surface-elevated">
                  <span className="text-sm text-slate-300 w-36 flex-shrink-0 truncate">{stat}</span>
                  <div className="flex-1">
                    <HitRateBar rate={d.hitRate} />
                  </div>
                  <span className={clsx('text-sm font-mono font-bold w-14 text-right', {
                    'text-positive': d.hitRate >= 0.55,
                    'text-white': d.hitRate >= 0.5 && d.hitRate < 0.55,
                    'text-negative': d.hitRate < 0.5,
                  })}>
                    {(d.hitRate * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-600 w-14 text-right">{d.n} picks</span>
                </div>
              ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="font-semibold text-white text-sm">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function MetricCard({ label, value, sub, color, icon }) {
  return (
    <div className="bg-surface-raised rounded-xl border border-border-subtle p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-slate-500">{icon}</span>}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className={clsx('text-2xl font-bold font-mono', color)}>{value}</p>
      <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
    </div>
  )
}

function HitRateBar({ rate }) {
  const pct = Math.min(100, Math.max(0, rate * 100))
  return (
    <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden mt-1">
      <div
        className={clsx('h-full rounded-full transition-all', {
          'bg-positive': rate >= 0.55,
          'bg-brand-400': rate >= 0.5 && rate < 0.55,
          'bg-negative': rate < 0.5,
        })}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
