import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import EVBoard from './pages/EVBoard'
import AutoBuilder from './pages/AutoBuilder'
import LiveGames from './pages/LiveGames'
import Lineups from './pages/Lineups'
import PickTracker from './pages/PickTracker'
import Bankroll from './pages/Bankroll'
import LineDetail from './pages/LineDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
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
      </Routes>
    </BrowserRouter>
  )
}
