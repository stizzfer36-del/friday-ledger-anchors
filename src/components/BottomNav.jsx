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

export default function BottomNav() {
  const slip = useStore(s => s.slip)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border-subtle bg-surface-raised">
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

      {/* Slip indicator badge */}
      {slip.length > 0 && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {slip.length} picks
        </div>
      )}
    </nav>
  )
}
