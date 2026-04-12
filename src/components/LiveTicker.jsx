import { useState } from 'react'
import { useStore } from '../store'
import { clsx } from 'clsx'

const SPORT_COLOR = {
  NBA: 'text-orange-400',
  NFL: 'text-blue-400',
  MLB: 'text-red-400',
  NHL: 'text-sky-400',
}

export default function LiveTicker() {
  const lines         = useStore(s => s.lines)
  const addToSlip     = useStore(s => s.addToSlip)
  const slip          = useStore(s => s.slip)
  const backendOnline = useStore(s => s.backendOnline)

  const [flash, setFlash] = useState(null)  // id of last-added pick

  const topPlays = lines
    .filter(l => l.recommendation === 'STRONG' || l.recommendation === 'GOOD')
    .sort((a, b) => (b.evScore || 0) - (a.evScore || 0))
    .slice(0, 20)

  if (topPlays.length === 0) return null

  const slipIds = new Set(slip.map(s => s.id))
  const items   = [...topPlays, ...topPlays]

  function handleClick(line) {
    const direction = line.pick === 'OVER' ? 'over' : 'under'
    addToSlip(line, direction)
    setFlash(line.id)
    setTimeout(() => setFlash(null), 800)
  }

  return (
    <div className="w-full bg-surface-raised border-b border-border-subtle overflow-hidden flex items-center h-8 flex-shrink-0">
      {/* Label */}
      <div className="flex items-center gap-1.5 px-3 border-r border-border-subtle h-full flex-shrink-0">
        <span className={clsx(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          backendOnline ? 'bg-ev-strong animate-pulse' : 'bg-slate-600'
        )} />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
          Top Plays
        </span>
      </div>

      {/* Scrolling track */}
      <div className="flex-1 overflow-hidden">
        <div className="ticker-track">
          {items.map((line, i) => (
            <TickerItem
              key={`${line.id}-${i}`}
              line={line}
              inSlip={slipIds.has(line.id)}
              flashing={flash === line.id}
              onClick={() => handleClick(line)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TickerItem({ line, inSlip, flashing, onClick }) {
  const sport      = line.sport || 'NBA'
  const sportColor = SPORT_COLOR[sport] || 'text-slate-400'
  const dir        = line.pick === 'OVER' ? '↑' : '↓'
  const dirColor   = line.pick === 'OVER' ? 'text-ev-good' : 'text-ev-fade'
  const hitPct     = line.hitRate != null ? `${Math.round(line.hitRate * 100)}%` : ''

  return (
    <button
      onClick={onClick}
      title={inSlip ? 'Already in slip' : `Add ${line.playerName} to slip`}
      className={clsx(
        'flex items-center gap-2 px-4 border-r border-border-subtle/50 h-8 flex-shrink-0 transition-colors cursor-pointer',
        flashing
          ? 'bg-brand-600/30'
          : inSlip
            ? 'bg-brand-600/10 hover:bg-brand-600/20'
            : 'hover:bg-surface-elevated'
      )}
    >
      <span className={clsx('text-[10px] font-bold uppercase', sportColor)}>{sport}</span>
      <span className={clsx(
        'text-xs font-semibold whitespace-nowrap',
        inSlip ? 'text-brand-300' : 'text-slate-200'
      )}>
        {line.playerName}
      </span>
      <span className="text-[10px] text-slate-500 whitespace-nowrap">{line.statType}</span>
      <span className={clsx('text-xs font-mono font-bold', dirColor)}>{dir} {line.line}</span>
      {hitPct && <span className="text-[10px] text-slate-500 font-mono">{hitPct}</span>}
      {line.trend === 'hot'  && <span className="text-[10px]">🔥</span>}
      {line.trend === 'cold' && <span className="text-[10px]">❄️</span>}
      {inSlip && <span className="text-[10px] text-brand-400 font-bold">✓</span>}
    </button>
  )
}
