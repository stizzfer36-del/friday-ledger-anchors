import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import SlipPanel from './SlipPanel'
import LiveTicker from './LiveTicker'
import BottomNav from './BottomNav'
import { useStore } from '../store'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const slip = useStore(s => s.slip)
  const location = useLocation()

  // Auto-close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#06090E' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar isOpen={sidebarOpen} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50 w-52">
            <Sidebar isOpen={true} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <LiveTicker />

        {/* Main content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto p-3 md:p-5 pb-20 md:pb-5">
          <Outlet />
        </main>
      </div>

      {/* Slip panel — full screen on mobile, sidebar on desktop */}
      {slip.length > 0 && <SlipPanel />}

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  )
}
