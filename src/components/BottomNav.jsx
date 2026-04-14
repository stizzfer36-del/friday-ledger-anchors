// Mobile bottom navigation bar — only visible on small screens
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Wand2, Clock, DollarSign } from 'lucide-react'
import { useStore } from '../store'
import { clsx } from 'clsx'

const NAV = [
  { to: '/',        icon: LayoutDashboard, label: 'Today', exact: true },
  { to: '/board',   icon: TrendingUp,      label: 'EV Board' },
  { to: '/builder', icon: Wand2,           label: 'Builder' },
  { to: '/entries', icon: Clock,           label: 'Entries' },
  { to: '/bankroll',icon: DollarSign,      label: 'Bankroll' },
]

export default function BottomNav({ onOpenSlip }) {
  const slip = useStore(s => s.slip)
  const slipFullFlash = useStore(s => s.slipFullFlash)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border-subtle bg-surface-raised">
      {/* Slip open button — shown above nav when picks are in slip */}
      {slip.length > 0 && (
        <button
          onClick={onOpenSlip}
          className={clsx(
            'w-full flex items-center justify-center gap-2 py-2 text-white text-sm font-bold active:bg-brand-700 transition-colors',
            slipFullFlash ? 'bg-negative animate-pulse' : 'bg-brand-600'
          )}
        >
          {slipFullFlash
            ? 'Slip full — max 5 picks'
            : `View Slip · ${slip.length} pick${slip.length !== 1 ? 's' : ''}`
          }
        </button>
      )}

      <div className="flex items-stretch">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => clsx(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
              isActive ? 'text-brand-400' : 'text-slate-500'
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
