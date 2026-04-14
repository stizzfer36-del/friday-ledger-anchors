import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Zap, TrendingUp, Shield, BarChart2, CheckCircle, ArrowRight, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import { clsx } from 'clsx'

export default function Landing() {
  const { user, isPro } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isNewUser = params.get('newUser') === 'true'
  const [plans, setPlans] = useState([])
  const [performance, setPerformance] = useState(null)
  const [dailySlip, setDailySlip] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(null)

  useEffect(() => {
    api.billing.plans().then(d => setPlans(d.plans || [])).catch(() => {})
    api.performance().then(setPerformance).catch(() => {})
    api.dailySlip().then(setDailySlip).catch(() => {})
  }, [])

  // Auto-scroll to pricing section for new signups
  useEffect(() => {
    if (isNewUser) {
      setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
      }, 400)
    }
  }, [isNewUser])

  async function handleCheckout(plan) {
    if (!user) { navigate('/login?redirect=/pricing'); return }
    setCheckoutLoading(plan)
    try {
      const { url, mock, mockUpgradeUrl } = await api.billing.checkout(plan)
      if (mock) {
        // Dev mode: directly upgrade
        await api.billing.mockUpgrade(plan)
        window.location.reload()
      } else if (url) {
        window.location.href = url
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setCheckoutLoading(null)
    }
  }

  const stats = performance?.byRecommendation

  return (
    <div className="min-h-screen" style={{ background: '#06090E', color: '#fff' }}>
      {/* ── New user banner ──────────────────────────────────────────────────── */}
      {isNewUser && (
        <div className="bg-brand-600 text-white text-sm text-center py-2.5 px-4 font-medium">
          Account created! Pick a plan below to unlock full EV scores and signals.
        </div>
      )}
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg">FlexEdge</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <button onClick={() => navigate('/')} className="btn-primary text-sm">
              Open App <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          ) : (
            <>
              <button onClick={() => navigate('/login')} className="btn-ghost text-sm">Sign in</button>
              <button onClick={() => navigate('/login?mode=register')} className="btn-primary text-sm">
                Get started
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-400 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          Replacing pick services since 2025
        </div>
        <h1 className="text-5xl font-extrabold leading-tight mb-5">
          Stop paying a capper.<br />
          <span className="text-brand-400">Pay the machine.</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
          Every PrizePicks line scored by a multi-factor EV model. Real track record, publicly verified.
          No gut picks. No Discord. No receipts that disappeared.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button onClick={() => navigate('/login?mode=register')} className="btn-primary px-8 py-3 text-base">
            Start free → go Pro at $40/mo
          </button>
          <a href="#performance" className="btn-ghost px-8 py-3 text-base">
            See the receipts
          </a>
        </div>
      </section>

      {/* ── Track record ──────────────────────────────────────────────────────── */}
      <section id="performance" className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-surface-raised rounded-2xl border border-border-subtle p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-brand-400" />
            <div>
              <h2 className="font-bold text-white text-lg">Model Track Record</h2>
              <p className="text-slate-500 text-xs">Verified. Auto-settled. No cherry-picking.</p>
            </div>
          </div>

          {performance?.summary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatBox
                label="Overall Hit Rate"
                value={`${(performance.summary.hitRate * 100).toFixed(1)}%`}
                sub={`${performance.summary.picks} picks tracked`}
                color={performance.summary.hitRate >= 0.55 ? 'text-positive' : 'text-slate-400'}
              />
              {stats?.STRONG && (
                <StatBox
                  label="STRONG Picks"
                  value={`${(stats.STRONG.hitRate * 100).toFixed(1)}%`}
                  sub={`${stats.STRONG.n} picks`}
                  color="text-ev-strong"
                />
              )}
              {stats?.GOOD && (
                <StatBox
                  label="GOOD Picks"
                  value={`${(stats.GOOD.hitRate * 100).toFixed(1)}%`}
                  sub={`${stats.GOOD.n} picks`}
                  color="text-ev-good"
                />
              )}
              <StatBox
                label="vs Break-Even"
                value={performance.summary.hitRate >= 0.5 ? `+${((performance.summary.hitRate - 0.5) * 100).toFixed(1)}%` : `${((performance.summary.hitRate - 0.5) * 100).toFixed(1)}%`}
                sub="above 50% baseline"
                color={performance.summary.hitRate >= 0.5 ? 'text-positive' : 'text-negative'}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Track record builds as picks accumulate.</p>
              <p className="text-xs mt-1">Sign up and start logging picks to contribute.</p>
            </div>
          )}

          <p className="text-xs text-slate-600 mt-2">
            All picks auto-settled via ESPN box scores. Results are permanent and uneditable.
          </p>
        </div>
      </section>

      {/* ── Today's picks preview ─────────────────────────────────────────────── */}
      {dailySlip?.topPicks?.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-8">
          <h2 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-400" />
            Today's Top Picks
            <span className="text-xs text-slate-500 font-normal ml-auto">Unlock all with Pro</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {dailySlip.topPicks.slice(0, 3).map((pick, i) => (
              <PickPreviewCard key={i} pick={pick} />
            ))}
          </div>
          {dailySlip._limited && (
            <div className="mt-4 text-center">
              <button
                onClick={() => navigate('/login?mode=register')}
                className="btn-primary text-sm px-6"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                Unlock all {dailySlip.meta?.strongCount + dailySlip.meta?.goodCount}+ picks with Pro
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Feature comparison ────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="font-bold text-white text-xl text-center mb-8">
          What we replaced
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ['Discord capper ($40-60/mo)', 'Daily picks feed, ranked by EV'],
            ['Self-reported "record"', 'Public verified track record, auto-settled'],
            ['Hidden spreadsheet model', 'Transparent multi-factor engine'],
            ['Gut feel + clout', 'Calibration: your data validates the model'],
            ['Separate Kelly calculator', 'Built-in, calibrated to your bankroll'],
            ['Line movement bot ($15/mo)', 'Native line alerts, free with Pro'],
          ].map(([old, newThing], i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-raised border border-border-subtle">
              <div className="flex-shrink-0 text-slate-600 line-through text-sm pt-0.5">{old}</div>
              <ArrowRight className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">{newThing}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="font-bold text-white text-xl text-center mb-2">Pricing</h2>
        <p className="text-slate-500 text-sm text-center mb-8">Same price as a capper. Infinitely more honest.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map(plan => (
            <PricingCard
              key={plan.id}
              plan={plan}
              currentTier={user?.tier}
              loading={checkoutLoading === plan.id}
              onSelect={() => {
                if (plan.id === 'free') {
                  navigate(user ? '/' : '/login?mode=register')
                } else {
                  handleCheckout(plan.id)
                }
              }}
            />
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-brand-400" />
          <span className="font-bold text-white">FlexEdge</span>
        </div>
        <p className="text-slate-600 text-xs">
          Not affiliated with PrizePicks. For entertainment and analytical purposes only. Bet responsibly.
        </p>
      </footer>
    </div>
  )
}

function StatBox({ label, value, sub, color }) {
  return (
    <div className="bg-surface-elevated rounded-xl p-4 text-center">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={clsx('text-2xl font-bold font-mono', color)}>{value}</p>
      <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
    </div>
  )
}

function PickPreviewCard({ pick }) {
  const isLocked = pick._locked
  return (
    <div className={clsx(
      'bg-surface-raised border border-border-subtle rounded-xl p-4',
      isLocked && 'relative overflow-hidden'
    )}>
      <div className={clsx(isLocked && 'blur-sm pointer-events-none select-none')}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">{pick.sport} · {pick.statType}</span>
          <span className={clsx('text-xs font-bold px-2 py-0.5 rounded', {
            'text-ev-strong bg-ev-strong/10': pick.recommendation === 'STRONG',
            'text-ev-good bg-ev-good/10': pick.recommendation === 'GOOD',
            'text-slate-400 bg-slate-400/10': !['STRONG','GOOD'].includes(pick.recommendation),
          })}>
            {pick.recommendation}
          </span>
        </div>
        <p className="font-bold text-white">{pick.playerName}</p>
        <p className="text-slate-400 text-sm">{pick.pick} {pick.line} · {Math.round(pick.hitRate * 100)}% hit</p>
      </div>
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-raised/80">
          <Lock className="w-5 h-5 text-slate-400" />
        </div>
      )}
    </div>
  )
}

function PricingCard({ plan, currentTier, loading, onSelect }) {
  const isCurrent = currentTier === plan.id
  return (
    <div className={clsx(
      'rounded-2xl border p-6 flex flex-col',
      plan.highlight
        ? 'border-brand-500/50 bg-brand-900/20'
        : 'border-border-subtle bg-surface-raised'
    )}>
      {plan.highlight && (
        <div className="text-xs font-bold text-brand-400 uppercase tracking-wider mb-2">Most popular</div>
      )}
      <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
      <div className="flex items-baseline gap-1 mb-4">
        {plan.price === 0 ? (
          <span className="text-3xl font-bold text-white">Free</span>
        ) : (
          <>
            <span className="text-3xl font-bold text-white">${plan.price}</span>
            <span className="text-slate-500 text-sm">/ month</span>
          </>
        )}
      </div>
      <ul className="space-y-2 flex-1 mb-6">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
            <CheckCircle className="w-3.5 h-3.5 text-positive flex-shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        disabled={isCurrent || loading}
        className={clsx(
          'w-full py-2.5 rounded-lg text-sm font-semibold transition-colors',
          isCurrent
            ? 'bg-surface-elevated text-slate-500 cursor-default'
            : plan.highlight
              ? 'bg-brand-600 hover:bg-brand-500 text-white'
              : 'border border-border-subtle hover:bg-surface-elevated text-slate-300'
        )}
      >
        {loading ? 'Loading…' : isCurrent ? 'Current plan' : plan.cta}
      </button>
    </div>
  )
}
