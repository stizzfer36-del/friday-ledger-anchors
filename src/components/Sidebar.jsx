import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, Zap,
  ListChecks, DollarSign, Radio, Wand2, Clock,
} from 'lucide-react'
import { useStore } from '../store'
import { clsx } from 'clsx'

const nav = [
  { to: '/',        icon: LayoutDashboard, label: 'Today',        exact: true },
  { to: '/builder', icon: Wand2,           label: 'Auto Builder', badge: 'NEW', highlight: true },
  { to: '/board',   icon: TrendingUp,      label: 'EV Board' },
  { to: '/live',    icon: Radio,           label: 'Live Games' },
  { to: '/lineups', icon: ListChecks,      label: 'Lineups' },
  { to: '/entries', icon: Clock,           label: 'My Entries' },
  { to: '/bankroll',icon: DollarSign,      label: 'Bankroll' },
]

export default function Sidebar({ isOpen }) {
  const lines         = useStore(s => s.lines)
  const slip          = useStore(s => s.slip)
  const backendOnline = useStore(s => s.backendOnline)
  const meta          = useStore(s => s.linesMeta)

  const topEV = lines.filter(l => l.recommendation === 'STRONG' || l.recommendation === 'GOOD').length

  return (
    <aside className={clsx(
      'flex flex-col border-r border-border-subtle transition-all duration-300 flex-shrink-0 bg-surface-raised',
      isOpen ? 'w-52' : 'w-14'
    )}>
      {/* Logo */}
      <div className={clsx(
        'flex items-center gap-3 px-3 py-4 border-b border-border-subtle',
        !isOpen && 'justify-center px-0'
      )}>
        <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-900/50">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {isOpen && (
          <div className="animate-fade-in min-w-0">
            <p className="text-sm font-bold text-white leading-tight">FlexEdge</p>
            <p className="text-xs text-slate-600 leading-tight">Smart Picks</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => clsx(
              'nav-link',
              isActive && 'active',
              !isOpen && 'justify-center px-0'
            )}
          >
            <item.icon className={clsx('w-4 h-4 flex-shrink-0', item.highlight && 'text-brand-400')} />
            {isOpen && (
              <span className="flex-1 animate-fade-in">{item.label}</span>
            )}
            {isOpen && item.badge && (
              <span className={clsx(
                'text-[10px] font-bold px-1.5 py-0.5 rounded',
                item.highlight ? 'text-white bg-brand-600' : 'text-brand-400 bg-brand-500/10'
              )}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Stats footer */}
      {isOpen && (
        <div className="px-3 py-4 border-t border-border-subtle space-y-2.5 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">Status</span>
            <div className="flex items-center gap-1.5">
              <span className={clsx('w-1.5 h-1.5 rounded-full', backendOnline ? 'bg-positive animate-pulse' : 'bg-slate-600')} />
              <span className={clsx('text-xs font-medium', backendOnline ? 'text-positive' : 'text-slate-600')}>
                {backendOnline ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">+EV Lines</span>
            <span className="font-mono text-xs font-semibold text-ev-strong">{topEV}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">Slip</span>
            <span className={clsx('font-mono text-xs font-semibold', slip.length > 0 ? 'text-brand-400' : 'text-slate-600')}>
              {slip.length} / 5
            </span>
          </div>
          {meta?.lastRefresh?.lines && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Updated</span>
              <span className="font-mono text-xs text-slate-500">{formatAge(meta.lastRefresh.lines)}</span>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

function formatAge(isoStr) {
  if (!isoStr) return '—'
  const mins = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}
