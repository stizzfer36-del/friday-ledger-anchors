import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import SlipPanel from './SlipPanel'
import LiveTicker from './LiveTicker'
import { useStore } from '../store'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const slip = useStore(s => s.slip)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#06090E' }}>
      <Sidebar isOpen={sidebarOpen} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <LiveTicker />
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>

      {slip.length > 0 && <SlipPanel />}
    </div>
  )
}
