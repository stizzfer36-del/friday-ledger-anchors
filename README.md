# FlexEdge - DFS Lineup Builder

A comprehensive PrizePicks-style DFS lineup management platform built with React and Node.js.

## Features

- **Dashboard** - Overview of profits, win rates, top picks, and live games
- **Player Search** - Search all players, filter by position/sport, view projections and trends
- **Lineup Builder** - Create and manage DFS lineups with drag-and-drop picks
- **Live Games** - Track live game scores and in-game player statistics
- **AI Studio** - Manage cron jobs for automated data fetching and AI model training
- **Picks Session** - Full picks management with analytics and profit tracking
- **Player Details** - Deep dive into player stats with interactive charts

## Tech Stack

- **Frontend**: React 18, React Router, Recharts, Tailwind CSS, Framer Motion
- **Backend**: Express.js, REST API
- **State Management**: Zustand

## Getting Started

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Run Backend Server (separate terminal)
```bash
npm run server
```

### Build for Production
```bash
npm run build
```

## Project Structure

```
prizepicks-clone/
├── src/
│   ├── components/     # Reusable React components
│   ├── pages/          # Page components
│   ├── api/            # API service layer
│   ├── data/           # Mock data
│   └── store.js        # Zustand state management
├── server/             # Express backend
└── public/             # Static assets
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/players` - List players
- `GET /api/players/:id` - Get player details
- `GET /api/games` - List games
- `POST /api/picks` - Create pick
- `POST /api/lineups` - Create lineup
- `POST /api/cron-jobs` - Create cron job

## Pages

1. `/` - Dashboard with stats and top picks
2. `/search` - Player search and filtering
3. `/lineups` - Lineup management
4. `/ai` - AI/cron job management
5. `/picks` - Current picks session
6. `/live` - Live games tracker
7. `/player/:id` - Individual player details
