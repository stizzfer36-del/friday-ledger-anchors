import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '../api'
import { clsx } from 'clsx'

const SPORT_DOT = { NBA: 'bg-orange-400', NFL: 'bg-blue-400', MLB: 'bg-red-400', NHL: 'bg-sky-400' }

export default function PickTracker() {
  const [picks,   setPicks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('active')  // 'active' | 'settled'

  const load = async () => {
    try {
      const data = await api.picks.list()
      setPicks(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const active  = picks.filter(p => !p.result)
  const settled = picks.filter(p =>  p.result)
  const wins    = settled.filter(p => p.result === 'hit').length
  const losses  = settled.filter(p => p.result === 'miss').length
  const winRate = settled.length > 0 ? Math.round(wins / settled.length * 100) : null

  return (
    <div className="max-w-2xl mx-auto p-5 space-y-4 animate-fade-in">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">My Entries</h2>
        <p className="text-xs text-slate-600 mt-0.5">Results update automatically after games end</p>
      </div>

      {/* Stats row */}
      {settled.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="Win Rate" value={winRate != null ? `${winRate}%` : '—'} color={winRate >= 55 ? 'text-emerald-400' : winRate >= 45 ? 'text-slate-300' : 'text-red-400'} />
          <StatBox label="Wins"     value={wins}    color="text-emerald-400" />
          <StatBox label="Losses"   value={losses}  color="text-red-400" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-1 w-fit">
        <TabBtn active={tab === 'active'}  onClick={() => setTab('active')}  label="Active"  count={active.length} />
        <TabBtn active={tab === 'settled'} onClick={() => setTab('settled')} label="Results" count={settled.length} />
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-slate-600 text-sm">Loading…</div>
      ) : (
        <>
          {tab === 'active' && (
            active.length === 0 ? (
              <EmptyState
                icon={<Clock className="w-8 h-8 text-slate-700 mx-auto mb-3" />}
                title="No active picks"
                sub="Lock in a slip from Today to start tracking"
              />
            ) : (
              <div className="space-y-2">
                {active.map(pick => <PickRow key={pick.id} pick={pick} />)}
              </div>
            )
          )}

          {tab === 'settled' && (
            settled.length === 0 ? (
              <EmptyState
                icon={<TrendingUp className="w-8 h-8 text-slate-700 mx-auto mb-3" />}
                title="No results yet"
                sub="Picks settle automatically once games are complete"
              />
            ) : (
              <div className="space-y-2">
                {settled.map(pick => <PickRow key={pick.id} pick={pick} />)}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}

function PickRow({ pick }) {
  const isWin  = pick.result === 'hit'
  const isLoss = pick.result === 'miss'
  const dot    = SPORT_DOT[pick.sport] || 'bg-slate-500'
  const isMore = pick.direction === 'over'

  const gameTime = pick.startTime
    ? new Date(pick.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div className={clsx(
      'card px-4 py-3 flex items-center gap-3',
      isWin  && 'border-emerald-500/30 bg-emerald-500/5',
      isLoss && 'border-red-500/30 bg-red-500/5'
    )}>
      {/* Status icon */}
      <div className="flex-shrink-0">
        {isWin  && <CheckCircle className="w-4 h-4 text-emerald-400" />}
        {isLoss && <XCircle     className="w-4 h-4 text-red-400" />}
        {!pick.result && <Clock className="w-4 h-4 text-slate-600" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />
          <p className="text-sm font-semibold text-white truncate">{pick.playerName}</p>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {pick.statType} · {isMore ? '↑ More' : '↓ Less'} {pick.line}
          {gameTime && <span className="text-slate-700"> · {gameTime}</span>}
        </p>
      </div>

      {/* Result badge */}
      <div className="flex-shrink-0 text-right">
        {isWin  && <span className="text-xs font-bold text-emerald-400">WIN</span>}
        {isLoss && <span className="text-xs font-bold text-red-400">LOSS</span>}
        {!pick.result && (
          <span className="text-[10px] text-slate-600 uppercase tracking-wide">Pending</span>
        )}
      </div>
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div className="card p-3 text-center">
      <p className={clsx('text-xl font-black font-mono', color)}>{value}</p>
      <p className="text-[10px] text-slate-600 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  )
}

function TabBtn({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
        active ? 'bg-surface-overlay text-white' : 'text-slate-500 hover:text-slate-300'
      )}
    >
      {label}
      {count > 0 && (
        <span className={clsx('text-[10px]', active ? 'text-slate-400' : 'text-slate-700')}>{count}</span>
      )}
    </button>
  )
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="card py-16 text-center">
      {icon}
      <p className="text-slate-500 text-sm">{title}</p>
      <p className="text-slate-600 text-xs mt-1">{sub}</p>
    </div>
  )
}
