import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useStore } from '../store'
import { api } from '../api'
import { InjuryBadge } from '../components/EVBadge'
import { clsx } from 'clsx'

const SPORT_DOT = { NBA: 'bg-orange-400', NFL: 'bg-blue-400', MLB: 'bg-red-400', NHL: 'bg-sky-400' }

export default function LineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const lines     = useStore(s => s.lines)
  const addToSlip = useStore(s => s.addToSlip)
  const slip      = useStore(s => s.slip)

  const [fetched,      setFetched]      = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [playerData,   setPlayerData]   = useState(null)
  const [playerLoading,setPlayerLoading]= useState(false)
  const [activeLine,   setActiveLine]   = useState(null)

  const baseLine = lines.find(l => l.id === id) || fetched

  useEffect(() => {
    if (!lines.find(l => l.id === id)) {
      setLoading(true)
      api.lines.get(id)
        .then(setFetched)
        .catch(() => setError('Pick not found or has expired'))
        .finally(() => setLoading(false))
    }
  }, [id, lines])

  useEffect(() => {
    if (!baseLine?.playerName) return
    setPlayerLoading(true)
    api.player(baseLine.playerName)
      .then(data => {
        setPlayerData(data)
        const current = data.lines.find(l => l.id === id) || data.lines[0]
        setActiveLine(current)
      })
      .catch(() => setActiveLine(baseLine))
      .finally(() => setPlayerLoading(false))
  }, [baseLine?.playerName])

  useEffect(() => {
    if (playerData && id) {
      const found = playerData.lines.find(l => l.id === id)
      if (found) setActiveLine(found)
    }
  }, [id, playerData])

  const line   = activeLine || baseLine
  const slipPick = slip.find(p => p.id === line?.id)
  const dot    = SPORT_DOT[line?.sport] || 'bg-slate-500'

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
    </div>
  )
  if (error || (!loading && !line)) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-600 text-sm gap-3">
      <p>{error || 'Pick not found.'}</p>
      <Link to="/" className="btn-ghost text-xs">← Back to Today</Link>
    </div>
  )
  if (!line) return null

  const hitPct    = line.hitRate != null ? Math.round(line.hitRate * 100) : null
  const gameLog   = playerData?.gameLog || []
  const statVals  = playerData?.statValues?.[line.statType] || []
  const splits    = playerData?.splits?.[line.statType]
  const isHot     = line.trend === 'hot'
  const isCold    = line.trend === 'cold'

  const gameTime  = line.startTime
    ? new Date(line.startTime).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  const chartData = statVals.length > 0
    ? statVals.map((v, i) => ({
        game: gameLog[i]?.date
          ? new Date(gameLog[i].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
          : `G${statVals.length - i}`,
        value: v,
        hit: v > line.line,
      })).reverse()
    : (line.recentGames || []).map((g, i) => ({
        game: `G${(line.recentGames.length - i)}`,
        value: g.statValue,
        hit: g.hitOver,
      })).reverse()

  const overs = chartData.filter(g => g.hit).length

  const colHighlight = {
    'Points': 'pts', 'Rebounds': 'reb', 'Assists': 'ast',
    'Blocked Shots': 'blk', 'Steals': 'stl', '3-PT Made': 'fg3m',
  }
  const highlightCol = colHighlight[line.statType]

  return (
    <div className="max-w-3xl mx-auto p-5 space-y-4 animate-fade-in">

      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> Today's Picks
      </Link>

      {/* Hero card */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-xl bg-surface-elevated flex items-center justify-center flex-shrink-0 border border-border-subtle">
              <span className="font-mono font-black text-xl text-slate-300">
                {line.playerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={clsx('w-2 h-2 rounded-full', dot)} />
                <span className="text-[10px] font-bold text-slate-500 uppercase">{line.sport}</span>
                {isHot  && <span className="text-sm">🔥</span>}
                {isCold && <span className="text-sm">❄️</span>}
              </div>
              <h1 className="text-xl font-bold text-white">{line.playerName}</h1>
              <p className="text-sm text-slate-500">{line.team} · {line.position}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <InjuryBadge status={line.injury?.status} reason={line.injury?.reason} />
                {gameTime && <span className="text-[10px] text-slate-600">{gameTime}</span>}
                {playerLoading && <RefreshCw className="w-3 h-3 text-slate-700 animate-spin" />}
              </div>
            </div>
          </div>

          {/* Line + More/Less */}
          <div className="flex flex-col items-end gap-2">
            <div className="text-center">
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">{line.statType}</p>
              <p className="text-4xl font-black text-white font-mono">{line.line}</p>
              {hitPct != null && <p className="text-xs text-slate-500 mt-0.5">Hit {hitPct}% · last 20</p>}
            </div>
            <div className="flex rounded-lg overflow-hidden border border-border-default w-40">
              <button
                onClick={() => addToSlip(line, 'over')}
                className={clsx(
                  'flex-1 py-2 text-sm font-bold transition-colors',
                  slipPick?.direction === 'over'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400'
                )}
              >
                ↑ More
              </button>
              <div className="w-px bg-border-default" />
              <button
                onClick={() => addToSlip(line, 'under')}
                className={clsx(
                  'flex-1 py-2 text-sm font-bold transition-colors',
                  slipPick?.direction === 'under'
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-slate-400 hover:bg-sky-500/10 hover:text-sky-400'
                )}
              >
                ↓ Less
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Other props for this player */}
      {playerData && playerData.lines.length > 1 && (
        <div>
          <p className="section-label px-1 mb-2">Other Props</p>
          <div className="flex flex-wrap gap-2">
            {playerData.lines.filter(pl => pl.id !== line.id).map(pLine => {
              const pSlip    = slip.find(p => p.id === pLine.id)
              const pHitPct  = pLine.hitRate != null ? Math.round(pLine.hitRate * 100) : null
              return (
                <button
                  key={pLine.id}
                  onClick={() => {
                    setActiveLine(pLine)
                    navigate(`/line/${pLine.id}`, { replace: true })
                  }}
                  className={clsx(
                    'px-3 py-2 rounded-lg border text-left transition-all',
                    pSlip
                      ? 'border-brand-500/50 bg-brand-500/10'
                      : 'border-border-default bg-surface-elevated hover:border-border-bright'
                  )}
                >
                  <p className="text-xs font-semibold text-white">{pLine.statType}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {pLine.line}
                    {pHitPct != null && <span className="ml-1.5">{pHitPct}% hit</span>}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox
          label="Hit Rate"
          value={hitPct != null ? `${hitPct}%` : '—'}
          sub={line.hitRateDisplay}
          color={hitPct >= 60 ? 'text-emerald-400' : hitPct >= 50 ? 'text-slate-300' : 'text-red-400'}
        />
        <StatBox
          label="Avg (L20)"
          value={line.projection?.toFixed(1) ?? '—'}
          sub={line.projection != null ? `vs ${line.line} line` : null}
          color={line.projection > line.line ? 'text-emerald-400' : 'text-sky-400'}
        />
        <StatBox
          label="Line"
          value={line.line}
          sub={line.statType}
        />
      </div>

      {/* Line movement note */}
      {line.lineMovement?.delta != null && line.lineMovement.delta !== 0 && (
        <div className="card px-4 py-3 flex items-center gap-2">
          {line.lineMovement.direction === 'down'
            ? <TrendingDown className="w-4 h-4 text-emerald-400" />
            : <TrendingUp   className="w-4 h-4 text-red-400" />}
          <p className="text-sm text-slate-300">
            Line moved {line.lineMovement.direction} by {Math.abs(line.lineMovement.delta).toFixed(1)} —
            <span className="text-slate-500 ml-1">
              {line.lineMovement.direction === 'down' ? 'books are buying the over' : 'books are buying the under'}
            </span>
          </p>
        </div>
      )}

      {/* Splits */}
      {splits && (
        <div>
          <p className="section-label px-1 mb-2">Splits vs {line.line}</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Last 5',  avg: splits.l5Avg,  hr: splits.l5HR  },
              { label: 'Last 10', avg: splits.l10Avg, hr: splits.l10HR },
              { label: 'Last 20', avg: splits.l20Avg, hr: splits.l20HR },
            ].map(({ label, avg, hr }) => (
              <div key={label} className="card p-3 text-center">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">{label}</p>
                <p className="font-mono text-2xl font-bold text-white">{avg}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">avg</p>
                <div className="mt-2 pt-2 border-t border-border-subtle">
                  <p className={clsx(
                    'font-mono text-lg font-bold',
                    hr >= 60 ? 'text-emerald-400' : hr >= 50 ? 'text-slate-300' : 'text-red-400'
                  )}>{hr}%</p>
                  <p className="text-[10px] text-slate-600">hit rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm font-semibold text-white">Last {chartData.length} Games</p>
            <p className="text-xs text-slate-600">
              {overs}/{chartData.length} over {line.line} ({chartData.length > 0 ? Math.round(overs / chartData.length * 100) : 0}%)
            </p>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={12} margin={{ right: 20, left: 0 }}>
                <XAxis dataKey="game" tick={{ fill: '#4B5563', fontSize: 9 }} axisLine={false} tickLine={false} interval={chartData.length > 10 ? 1 : 0} />
                <YAxis tick={{ fill: '#4B5563', fontSize: 10 }} axisLine={false} tickLine={false} width={28} domain={[0, 'auto']} />
                <ReferenceLine y={line.line} stroke="#F59E0B" strokeDasharray="4 2"
                  label={{ value: `${line.line}`, fill: '#F59E0B', fontSize: 9, position: 'right' }}
                />
                <Tooltip
                  contentStyle={{ background: '#0C1118', border: '1px solid #1A2D40', borderRadius: 6, fontSize: 11 }}
                  formatter={(v, _, props) => [`${v} ${line.statType} (${props.payload.hit ? '✓ Over' : '✗ Under'})`, '']}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.hit ? '#10E890' : '#F43F5E'} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Game log (NBA only — has named columns) */}
      {gameLog.length > 0 && highlightCol && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle">
            <p className="text-sm font-semibold text-white">Game Log</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className={clsx('text-right', highlightCol === 'pts'  ? 'text-brand-300' : 'text-slate-500')}>PTS</th>
                  <th className={clsx('text-right', highlightCol === 'reb'  ? 'text-brand-300' : 'text-slate-500')}>REB</th>
                  <th className={clsx('text-right', highlightCol === 'ast'  ? 'text-brand-300' : 'text-slate-500')}>AST</th>
                  <th className={clsx('text-right', highlightCol === 'fg3m' ? 'text-brand-300' : 'text-slate-500')}>3PM</th>
                  <th className={clsx('text-right', highlightCol === 'blk'  ? 'text-brand-300' : 'text-slate-500')}>BLK</th>
                  <th className={clsx('text-right', highlightCol === 'stl'  ? 'text-brand-300' : 'text-slate-500')}>STL</th>
                  {line.statType.includes('+') && <th className="text-right text-brand-300">{line.statType}</th>}
                </tr>
              </thead>
              <tbody>
                {gameLog.map((g, i) => {
                  const statVal = statVals[i]
                  const hitOver = statVal != null ? statVal > line.line : null
                  return (
                    <tr key={i} className={clsx(
                      hitOver === true  && 'bg-emerald-500/[0.04]',
                      hitOver === false && 'bg-red-500/[0.04]'
                    )}>
                      <td className="text-slate-400">{g.date || `G${i + 1}`}</td>
                      <GameCell val={g.pts}  isKey={highlightCol === 'pts'}  hitOver={highlightCol === 'pts'  ? hitOver : null} />
                      <GameCell val={g.reb}  isKey={highlightCol === 'reb'}  hitOver={highlightCol === 'reb'  ? hitOver : null} />
                      <GameCell val={g.ast}  isKey={highlightCol === 'ast'}  hitOver={highlightCol === 'ast'  ? hitOver : null} />
                      <GameCell val={g.fg3m} isKey={highlightCol === 'fg3m'} hitOver={highlightCol === 'fg3m' ? hitOver : null} />
                      <GameCell val={g.blk}  isKey={highlightCol === 'blk'}  hitOver={highlightCol === 'blk'  ? hitOver : null} />
                      <GameCell val={g.stl}  isKey={highlightCol === 'stl'}  hitOver={highlightCol === 'stl'  ? hitOver : null} />
                      {line.statType.includes('+') && (
                        <td className={clsx('text-right font-mono font-bold',
                          hitOver === true ? 'text-emerald-400' : hitOver === false ? 'text-red-400' : 'text-white'
                        )}>
                          {statVal?.toFixed(1) ?? '—'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, sub, color }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">{label}</p>
      <p className={clsx('font-mono text-2xl font-bold', color || 'text-white')}>{value ?? '—'}</p>
      {sub && <p className="text-[10px] text-slate-600 font-mono mt-0.5">{sub}</p>}
    </div>
  )
}

function GameCell({ val, isKey, hitOver }) {
  return (
    <td className={clsx('text-right font-mono',
      isKey
        ? hitOver === true  ? 'text-emerald-400 font-bold'
        : hitOver === false ? 'text-red-400 font-bold'
        : 'text-white font-semibold'
        : 'text-slate-500'
    )}>
      {val ?? '—'}
    </td>
  )
}
