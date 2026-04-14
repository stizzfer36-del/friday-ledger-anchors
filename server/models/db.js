// SQLite database initialization
// Provides persistent storage for users, picks (per-user), and bankroll.

import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, existsSync } from 'fs'

const __dir = dirname(fileURLToPath(import.meta.url))
// RAILWAY_VOLUME_MOUNT_PATH set when a Railway volume is attached; falls back to local data/
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? join(process.env.RAILWAY_VOLUME_MOUNT_PATH)
  : join(__dir, '..', 'data')
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = join(DATA_DIR, 'flexedge.db')
export const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    tier       TEXT NOT NULL DEFAULT 'free',
    stripeId   TEXT,
    createdAt  TEXT NOT NULL,
    updatedAt  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_picks (
    id             TEXT PRIMARY KEY,
    userId         TEXT NOT NULL REFERENCES users(id),
    lineId         TEXT,
    playerName     TEXT NOT NULL,
    team           TEXT,
    statType       TEXT NOT NULL,
    line           REAL NOT NULL,
    projection     REAL,
    evScore        REAL,
    recommendation TEXT,
    sport          TEXT,
    entryAmount    REAL DEFAULT 0,
    direction      TEXT,
    result         TEXT,
    settledAt      TEXT,
    loggedAt       TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_user_picks_userId ON user_picks(userId);
  CREATE INDEX IF NOT EXISTS idx_user_picks_result ON user_picks(userId, result);
  CREATE INDEX IF NOT EXISTS idx_user_picks_sport  ON user_picks(userId, sport);

  CREATE TABLE IF NOT EXISTS user_bankroll (
    id        TEXT PRIMARY KEY,
    userId    TEXT NOT NULL REFERENCES users(id),
    type      TEXT NOT NULL,
    amount    REAL NOT NULL,
    note      TEXT,
    pickId    TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bankroll_userId ON user_bankroll(userId);
`)

console.log('[db] SQLite initialized:', DB_PATH)
