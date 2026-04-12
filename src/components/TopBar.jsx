import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, RefreshCw, Search } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../api'
import { clsx } from 'clsx'

const TITLES = {
  '/':        'Today',
  '/builder': 'Auto Builder',
  '/board':   'EV Board',
  '/live':    'Live Games',
  '/lineups': 'Lineups',
  '/entries': 'My Entries',
  '/tracker': 'My Entries',
  '/bankroll':'Bankroll',
}

export default function TopBar({ onToggleSidebar }) {
  const location         = useLocation()
  const backendOnline    = useStore(s => s.backendOnline)
  const setBackendOnline = useStore(s => s.setBackendOnline)
  const setLines         = useStore(s => s.setLines)
  const setLinesLoading  = useStore(s => s.setLinesLoading)
  const linesLoading     = useStore(s => s.linesLoading)
  const filters          = useStore(s => s.filters)
  const setFilter        = useStore(s => s.setFilter)

  const loadLines = async () => {
    setLinesLoading(true)
    try {
      const result = await api.lines.list({})
      setLines(result.data, result.meta)
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    } finally {
      setLinesLoading(false)
    }
  }

  useEffect(() => {
    loadLines()
    const interval = setInterval(loadLines, 120000)
    return () => clearInterval(interval)
  }, [])

  const title = TITLES[location.pathname] || 'FlexEdge'

  return (
    <header className="h-12 flex-shrink-0 flex items-center justify-between px-4 border-b border-border-subtle bg-surface-raised">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-surface-elevated text-slate-600 hover:text-slate-300 transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{title}</span>
          <div className="flex items-center gap-1.5">
            {backendOnline ? (
              <>
                <span className="live-dot" />
                <span className="text-xs text-ev-strong font-mono font-medium">LIVE</span>
              </>
            ) : (
              <span className="text-xs text-slate-600">OFFLINE</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input
            type="text"
            placeholder="Search players…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="input pl-8 text-xs w-44 h-8"
          />
        </div>
        <button
          onClick={loadLines}
          disabled={linesLoading}
          className="btn-ghost h-8 w-8 p-0"
          title="Refresh"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', linesLoading && 'animate-spin')} />
        </button>
      </div>
    </header>
  )
}
