export const players = [
  { id: '1', name: 'Luka Doncic', team: 'DAL', position: 'PG', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/1629029.png' },
  { id: '2', name: 'Giannis Antetokounmpo', team: 'MIL', position: 'PF', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/1629029.png' },
  { id: '3', name: 'Stephen Curry', team: 'GSW', position: 'PG', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/201939.png' },
  { id: '4', name: 'LeBron James', team: 'LAL', position: 'SF', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/2544.png' },
  { id: '5', name: 'Kevin Durant', team: 'PHX', position: 'SF', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/201142.png' },
  { id: '6', name: 'Jayson Tatum', team: 'BOS', position: 'SF', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/1628369.png' },
  { id: '7', name: 'Nikola Jokic', team: 'DEN', position: 'C', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/1629029.png' },
  { id: '8', name: 'Joel Embiid', team: 'PHI', position: 'C', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/1629029.png' },
  { id: '9', name: 'Ja Morant', team: 'MEM', position: 'PG', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/1629029.png' },
  { id: '10', name: 'Donovan Mitchell', team: 'CLE', position: 'SG', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/1629029.png' },
  { id: '11', name: 'De\'Aaron Fox', team: 'SAC', position: 'PG', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/1629029.png' },
  { id: '12', name: 'Trae Young', team: 'ATL', position: 'PG', sport: 'NBA', image: 'https://cdn.nba.comheadshots/nba/1629029.png' },
]

export const games = [
  { 
    id: 'g1', 
    home: 'DAL', 
    away: 'GSW', 
    homeScore: 98, 
    awayScore: 95, 
    status: 'LIVE',
    quarter: '3rd',
    time: '5:42',
    sport: 'NBA',
    startTime: '7:30 PM ET'
  },
  { 
    id: 'g2', 
    home: 'LAL', 
    away: 'BOS', 
    homeScore: 0, 
    awayScore: 0, 
    status: 'UPCOMING',
    sport: 'NBA',
    startTime: '8:00 PM ET'
  },
  { 
    id: 'g3', 
    home: 'MIL', 
    away: 'PHX', 
    homeScore: 112, 
    awayScore: 108, 
    status: 'FINAL',
    sport: 'NBA',
    startTime: '7:00 PM ET'
  },
  { 
    id: 'g4', 
    home: 'DEN', 
    away: 'MEM', 
    homeScore: 45, 
    awayScore: 52, 
    status: 'LIVE',
    quarter: '2nd',
    time: '2:15',
    sport: 'NBA',
    startTime: '8:30 PM ET'
  },
  { id: 'g5', home: 'PHI', away: 'CLE', homeScore: 0, awayScore: 0, status: 'UPCOMING', sport: 'NBA', startTime: '9:00 PM ET' },
  { id: 'g6', home: 'SAC', away: 'ATL', homeScore: 0, awayScore: 0, status: 'UPCOMING', sport: 'NBA', startTime: '9:30 PM ET' },
]

export const projections = {
  '1': { points: 28.5, rebounds: 8.2, assists: 7.5,PRA: 44.2, history: [42, 38, 45, 41, 44, 46, 43] },
  '2': { points: 31.2, rebounds: 11.8, assists: 5.9,PRA: 48.9, history: [50, 47, 52, 45, 49, 51, 48] },
  '3': { points: 26.8, rebounds: 4.5, assists: 6.2,PRA: 37.5, history: [35, 38, 32, 40, 36, 39, 37] },
  '4': { points: 24.5, rebounds: 7.8, assists: 8.2,PRA: 40.5, history: [38, 42, 39, 41, 37, 43, 40] },
  '5': { points: 27.3, rebounds: 6.5, assists: 5.1,PRA: 38.9, history: [36, 41, 38, 42, 37, 40, 39] },
  '6': { points: 26.1, rebounds: 8.3, assists: 4.5,PRA: 38.9, history: [37, 40, 36, 41, 38, 39, 42] },
  '7': { points: 24.8, rebounds: 11.2, assists: 9.5,PRA: 45.5, history: [48, 44, 46, 50, 42, 47, 45] },
  '8': { points: 33.2, rebounds: 10.5, assists: 4.2,PRA: 47.9, history: [45, 50, 48, 52, 46, 49, 51] },
  '9': { points: 25.6, rebounds: 5.8, assists: 7.1,PRA: 38.5, history: [36, 40, 35, 42, 38, 41, 39] },
  '10': { points: 26.9, rebounds: 4.8, assists: 5.5,PRA: 37.2, history: [35, 39, 38, 40, 36, 41, 37] },
  '11': { points: 25.2, rebounds: 4.2, assists: 6.8,PRA: 36.2, history: [34, 38, 37, 39, 35, 40, 36] },
  '12': { points: 27.8, rebounds: 3.2, assists: 10.2,PRA: 41.2, history: [42, 38, 44, 40, 43, 39, 45] },
}

export const playerStats = {
  '1': { 
    games: 45, 
    avgPoints: 28.5, 
    avgRebounds: 8.2, 
    avgAssists: 7.5,
    fgPct: 47.2,
    threePtPct: 35.8,
    usageRate: 32.5,
    defensiveRating: 108.2,
    offensiveRating: 118.5,
  },
  '2': { 
    games: 48, 
    avgPoints: 31.2, 
    avgRebounds: 11.8, 
    avgAssists: 5.9,
    fgPct: 54.7,
    threePtPct: 28.5,
    usageRate: 35.8,
    defensiveRating: 102.4,
    offensiveRating: 122.1,
  },
}

export const lineups = [
  { id: 1, name: 'NBA Sharp', picks: [1, 2, 3, 4, 5], sport: 'NBA', status: 'active', profit: 245.50 },
  { id: 2, name: 'Value Stack', picks: [6, 7, 8, 9, 10], sport: 'NBA', status: 'completed', profit: -85.00 },
  { id: 3, name: 'High Upside', picks: [11, 12, 1, 2, 3], sport: 'NBA', status: 'pending', profit: 0 },
]

export const generateProjectionHistory = (base, games = 20) => {
  const history = []
  let value = base
  for (let i = 0; i < games; i++) {
    value = value + (Math.random() - 0.5) * 8
    history.push(Math.max(15, value))
  }
  return history
}
