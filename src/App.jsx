import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Performance from './pages/Performance'
import Dashboard from './pages/Dashboard'
import EVBoard from './pages/EVBoard'
import AutoBuilder from './pages/AutoBuilder'
import LiveGames from './pages/LiveGames'
import Lineups from './pages/Lineups'
import PickTracker from './pages/PickTracker'
import Bankroll from './pages/Bankroll'
import LineDetail from './pages/LineDetail'

// Routes that require authentication
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes — no auth required */}
      <Route path="/landing" element={<Landing />} />
      <Route path="/pricing" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      {/* Main app shell */}
      <Route path="/" element={<Layout />}>
        {/* Public within app shell */}
        <Route path="performance" element={<Performance />} />

        {/* Authenticated app pages */}
        <Route index element={<Dashboard />} />
        <Route path="builder" element={<AutoBuilder />} />
        <Route path="board" element={<EVBoard />} />
        <Route path="live" element={<LiveGames />} />
        <Route path="lineups" element={<Lineups />} />
        <Route path="entries" element={<PickTracker />} />
        <Route path="tracker" element={<PickTracker />} />
        <Route path="bankroll" element={<Bankroll />} />
        <Route path="line/:id" element={<LineDetail />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
