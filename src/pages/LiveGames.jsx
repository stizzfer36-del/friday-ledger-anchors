import { useStore } from '../store'
import { Radio, Clock } from 'lucide-react'
import { clsx } from 'clsx'

export default function LiveGames() {
  const lines = useStore(s => s.lines)

  const teams = {}
  lines.forEach(l => {
    if (l.team) {
      if (!teams[l.team]) teams[l.team] = { team: l.team, lines: [] }
      teams[l.team].lines.push(l)
    }
  })

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h2 className="text-base font-bold text-white">Live Games</h2>
        <p className="text-sm text-slate-600">Teams with active lines on today's slate</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.values(teams).map(({ team, lines: teamLines }) => {
          const topLine = teamLines.slice().sort((a, b) => b.evScore - a.evScore)[0]
          const avgEV = teamLines.reduce((s, l) => s + l.evScore, 0) / teamLines.length
          return (
            <div key={team} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                    <span className="font-mono font-bold text-brand-400 text-sm">{team}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{team}</p>
                    <p className="text-xs text-slate-600">{teamLines.length} active lines</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={clsx('font-mono text-sm font-bold', avgEV >= 5 ? 'text-ev-good' : avgEV >= 0 ? 'text-slate-400' : 'text-ev-fade')}>
                    avg {avgEV >= 0 ? '+' : ''}{avgEV.toFixed(1)}
                  </p>
                  {topLine?.minutesToGame != null && (
                    <p className="text-xs text-slate-600 flex items-center gap-1 justify-end font-mono">
                      <Clock className="w-2.5 h-2.5" />
                      {topLine.minutesToGame <= 0 ? 'LIVE' : topLine.minutesToGame < 60 ? topLine.minutesToGame + 'm' : Math.floor(topLine.minutesToGame/60) + 'h ' + (topLine.minutesToGame%60) + 'm'}
                    </p>
                  )}
                </div>
              </div>
              {topLine && (
                <div className="bg-surface-base rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">{topLine.playerName}</p>
                    <p className="text-xs text-slate-600">{topLine.statType} O/U {topLine.line}</p>
                  </div>
                  <div className="text-right">
                    <p className={clsx('font-mono text-sm font-bold', topLine.evScore >= 10 ? 'text-ev-strong' : topLine.evScore >= 3 ? 'text-ev-good' : 'text-slate-400')}>
                      {topLine.evScore > 0 ? '+' : ''}{topLine.evScore}
                    </p>
                    <p className="text-xs text-slate-600 font-mono">{(topLine.hitRate * 100).toFixed(0)}% hit</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {Object.keys(teams).length === 0 && (
        <div className="card py-16 text-center">
          <Radio className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No active lines loaded yet</p>
        </div>
      )}
    </div>
  )
}
