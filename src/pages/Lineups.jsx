import { useState } from 'react'
import { ListChecks, Plus, Trash2, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { EVBadge } from '../components/EVBadge'
import { clsx } from 'clsx'

export default function Lineups() {
  const lines = useStore(s => s.lines)
  const [lineups, setLineups] = useState([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const topLines = lines.filter(l => l.evScore > 5).slice(0, 5)

  const createLineup = () => {
    if (!name.trim() || topLines.length === 0) return
    setLineups(prev => [...prev, {
      id: Date.now(),
      name: name.trim(),
      picks: topLines.map(l => ({ id: l.id, playerName: l.playerName, statType: l.statType, line: l.line, evScore: l.evScore, recommendation: l.recommendation })),
      createdAt: new Date().toISOString(),
    }])
    setName('')
    setCreating(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Lineups</h2>
          <p className="text-sm text-slate-600">Save and organize your pick combinations</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary text-xs h-8 gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Lineup
        </button>
      </div>

      {creating && (
        <div className="card p-4 animate-slide-up">
          <p className="text-sm font-semibold text-white mb-3">Quick Build — Top EV Picks</p>
          <div className="space-y-2 mb-4">
            {topLines.map(l => (
              <div key={l.id} className="flex items-center justify-between bg-surface-base rounded px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-white">{l.playerName}</p>
                  <p className="text-xs text-slate-600">{l.statType} O/U {l.line}</p>
                </div>
                <EVBadge recommendation={l.recommendation} evScore={l.evScore} compact />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Lineup name…" className="input text-xs h-8 flex-1" />
            <button onClick={createLineup} className="btn-primary text-xs h-8 px-4">Save</button>
            <button onClick={() => setCreating(false)} className="btn-ghost text-xs h-8">Cancel</button>
          </div>
        </div>
      )}

      {lineups.length === 0 && !creating && (
        <div className="card py-16 text-center">
          <ListChecks className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No lineups saved yet.</p>
          <p className="text-slate-600 text-xs mt-1">Create a lineup to lock in a set of picks.</p>
        </div>
      )}

      {lineups.map(lineup => (
        <div key={lineup.id} className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div>
              <p className="text-sm font-semibold text-white">{lineup.name}</p>
              <p className="text-xs text-slate-600">{lineup.picks.length} picks · {new Date(lineup.createdAt).toLocaleDateString()}</p>
            </div>
            <button onClick={() => setLineups(prev => prev.filter(l => l.id !== lineup.id))} className="btn-ghost w-7 h-7 p-0 text-slate-600 hover:text-ev-fade">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-border-subtle">
            {lineup.picks.map(pick => (
              <div key={pick.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-xs font-medium text-white">{pick.playerName}</p>
                  <p className="text-xs text-slate-600">{pick.statType} O/U {pick.line}</p>
                </div>
                <EVBadge recommendation={pick.recommendation} evScore={pick.evScore} compact />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
