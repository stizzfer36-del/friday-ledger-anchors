import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, RefreshCw, Search, Bell, LogOut, Crown, ChevronDown } from 'lucide-react'
import { useStore } from '../store'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import { clsx } from 'clsx'

const TITLES = {
  '/':           'Today',
  '/builder':    'Auto Builder',
  '/board':      'EV Board',
  '/live':       'Live Games',
  '/lineups':    'Lineups',
  '/entries':    'My Entries',
  '/tracker':    'My Entries',
  '/bankroll':   'Bankroll',
  '/performance':'Track Record',
}

export default function TopBar({ onToggleSidebar }) {
  const location         = useLocation()
  const navigate         = useNavigate()
  const { user, isPro, logout } = useAuth()

  const backendOnline    = useStore(s => s.backendOnline)
  const setBackendOnline = useStore(s => s.setBackendOnline)
  const setLines         = useStore(s => s.setLines)
  const setLinesLoading  = useStore(s => s.setLinesLoading)
  const linesLoading     = useStore(s => s.linesLoading)
  const filters          = useStore(s => s.filters)
  const setFilter        = useStore(s => s.setFilter)

  const [lineAlertCount, setLineAlertCount] = useState(0)
  const [showUserMenu, setShowUserMenu] = useState(false)

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

  // Poll for line movement alerts every 5 minutes
  const checkAlerts = async () => {
    try {
      const data = await api.lineAlerts()
      setLineAlertCount(data.count || 0)
    } catch {}
  }

  useEffect(() => {
    loadLines()
    checkAlerts()
    const linesInterval = setInterval(loadLines, 120000)
    const alertsInterval = setInterval(checkAlerts, 300000)
    return () => { clearInterval(linesInterval); clearInterval(alertsInterval) }
  }, [])

  const title = TITLES[location.pathname] || 'FlexEdge'

  return (
    <header className="h-12 flex-shrink-0 flex items-center justify-between px-3 md:px-4 border-b border-border-subtle bg-surface-raised relative">
      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-surface-elevated text-slate-600 hover:text-slate-300 transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{title}</span>
          <div className="hidden sm:flex items-center gap-1.5">
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

      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Search — hidden on mobile */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input
            type="text"
            placeholder="Search players…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="input pl-8 text-xs w-44 h-8"
          />
        </div>

        {/* Line alerts bell */}
        <button
          onClick={() => navigate('/board')}
          className="relative btn-ghost h-8 w-8 p-0"
          title="Line movement alerts"
        >
          <Bell className="w-3.5 h-3.5" />
          {lineAlertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-brand-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {lineAlertCount > 9 ? '9+' : lineAlertCount}
            </span>
          )}
        </button>

        {/* Refresh */}
        <button
          onClick={loadLines}
          disabled={linesLoading}
          className="btn-ghost h-8 w-8 p-0"
          title="Refresh"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', linesLoading && 'animate-spin')} />
        </button>

        {/* Upgrade button for free users */}
        {user && !isPro && (
          <button
            onClick={() => navigate('/pricing')}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600/20 border border-brand-500/30 text-brand-400 text-xs font-semibold hover:bg-brand-600/30 transition-colors"
          >
            <Crown className="w-3 h-3" />
            Upgrade
          </button>
        )}

        {/* User menu */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors text-xs text-slate-400"
            >
              <div className={clsx(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                isPro ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-300'
              )}>
                {user.email[0].toUpperCase()}
              </div>
              <span className="hidden md:inline max-w-20 truncate">{user.email.split('@')[0]}</span>
              <ChevronDown className="w-3 h-3 hidden md:block" />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-surface-raised border border-border-subtle rounded-xl shadow-xl z-50 py-1">
                  <div className="px-3 py-2 border-b border-border-subtle">
                    <p className="text-xs text-slate-300 truncate">{user.email}</p>
                    <p className={clsx('text-xs font-bold mt-0.5', isPro ? 'text-brand-400' : 'text-slate-500')}>
                      {isPro ? (user.tier === 'elite' ? 'Elite' : 'Pro') : 'Free plan'}
                    </p>
                  </div>
                  {!isPro && (
                    <button
                      onClick={() => { navigate('/pricing'); setShowUserMenu(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-brand-400 hover:bg-surface-elevated flex items-center gap-2"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      Upgrade to Pro
                    </button>
                  )}
                  <button
                    onClick={() => { navigate('/performance'); setShowUserMenu(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-surface-elevated"
                  >
                    Track Record
                  </button>
                  <button
                    onClick={() => { logout(); setShowUserMenu(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-surface-elevated flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="btn-primary text-xs h-8 px-3"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  )
}
