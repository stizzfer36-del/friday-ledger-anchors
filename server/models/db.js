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

function ensureColumn(table, column, ddl) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!columns.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
}

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

  CREATE TABLE IF NOT EXISTS chain_rows (
    chain_seq       INTEGER PRIMARY KEY AUTOINCREMENT,
    row_type        TEXT NOT NULL,
    schema_version  TEXT NOT NULL,
    prev_hash       TEXT,
    row_hash        TEXT NOT NULL UNIQUE,
    payload_hash    TEXT NOT NULL,
    canonical_json  TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    clock_source    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_chain_rows_type ON chain_rows(row_type, chain_seq);

  CREATE TABLE IF NOT EXISTS raw_source_records (
    id                     TEXT PRIMARY KEY,
    chain_seq              INTEGER NOT NULL UNIQUE REFERENCES chain_rows(chain_seq),
    source_name            TEXT NOT NULL,
    source_record_key      TEXT NOT NULL,
    source_event_timestamp TEXT,
    ingest_timestamp       TEXT NOT NULL,
    fetch_url              TEXT,
    http_status            INTEGER,
    sport                  TEXT,
    player_name            TEXT,
    market_type            TEXT,
    numeric_value          REAL,
    event_start_time       TEXT,
    payload_json           TEXT NOT NULL,
    payload_hash           TEXT NOT NULL,
    UNIQUE(source_name, source_record_key, payload_hash)
  );

  CREATE INDEX IF NOT EXISTS idx_raw_source_records_lookup
    ON raw_source_records(source_name, source_record_key, ingest_timestamp DESC);

  CREATE TABLE IF NOT EXISTS feature_snapshots (
    id                  TEXT PRIMARY KEY,
    chain_seq           INTEGER NOT NULL UNIQUE REFERENCES chain_rows(chain_seq),
    sport               TEXT NOT NULL,
    league              TEXT NOT NULL,
    game_key            TEXT,
    player_name         TEXT NOT NULL,
    market_type         TEXT NOT NULL,
    feature_json        TEXT NOT NULL,
    feature_hash        TEXT NOT NULL UNIQUE,
    source_record_ids   TEXT NOT NULL,
    source_count        INTEGER NOT NULL,
    created_at          TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_feature_snapshots_market
    ON feature_snapshots(sport, market_type, created_at DESC);

  CREATE TABLE IF NOT EXISTS prediction_runs (
    id                      TEXT PRIMARY KEY,
    chain_seq               INTEGER NOT NULL UNIQUE REFERENCES chain_rows(chain_seq),
    stream                  TEXT NOT NULL DEFAULT 'research',
    sport                   TEXT NOT NULL,
    market_type             TEXT NOT NULL,
    visibility              TEXT NOT NULL,
    model_label             TEXT NOT NULL,
    model_artifact_hash     TEXT NOT NULL,
    runner_git_commit_hash  TEXT NOT NULL,
    config_bundle_hash      TEXT NOT NULL,
    container_env_hash      TEXT NOT NULL,
    seed                    TEXT NOT NULL,
    created_at              TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id                                 TEXT PRIMARY KEY,
    chain_seq                          INTEGER NOT NULL UNIQUE REFERENCES chain_rows(chain_seq),
    prediction_run_id                  TEXT NOT NULL REFERENCES prediction_runs(id),
    feature_snapshot_id                TEXT NOT NULL REFERENCES feature_snapshots(id),
    raw_source_record_id               TEXT NOT NULL REFERENCES raw_source_records(id),
    stream                             TEXT NOT NULL DEFAULT 'research',
    sport                              TEXT NOT NULL,
    league                             TEXT NOT NULL,
    game_key                           TEXT,
    player_name                        TEXT NOT NULL,
    market_type                        TEXT NOT NULL,
    claim                              TEXT NOT NULL,
    visibility                         TEXT NOT NULL,
    source_name                        TEXT NOT NULL,
    line_value_at_prediction           REAL NOT NULL,
    market_implied_prob_at_prediction  REAL NOT NULL,
    predicted_probability              REAL NOT NULL,
    expected_value                     REAL NOT NULL,
    explanation_summary                TEXT NOT NULL,
    created_at                         TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_predictions_market
    ON predictions(sport, market_type, created_at DESC);

  CREATE TABLE IF NOT EXISTS evaluation_specs (
    id             TEXT PRIMARY KEY,
    chain_seq      INTEGER NOT NULL UNIQUE REFERENCES chain_rows(chain_seq),
    version        TEXT NOT NULL UNIQUE,
    spec_json      TEXT NOT NULL,
    spec_hash      TEXT NOT NULL UNIQUE,
    is_active      INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS outcome_settlements (
    id                               TEXT PRIMARY KEY,
    chain_seq                        INTEGER NOT NULL UNIQUE REFERENCES chain_rows(chain_seq),
    prediction_id                    TEXT NOT NULL UNIQUE REFERENCES predictions(id),
    source_name                      TEXT NOT NULL,
    source_record_id                 TEXT REFERENCES raw_source_records(id),
    actual_value                     REAL NOT NULL,
    outcome                          TEXT NOT NULL,
    settled_at                       TEXT NOT NULL,
    line_value_at_close              REAL NOT NULL,
    market_implied_prob_at_close     REAL NOT NULL,
    clv                              REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prediction_metrics (
    id                 TEXT PRIMARY KEY,
    chain_seq          INTEGER NOT NULL UNIQUE REFERENCES chain_rows(chain_seq),
    prediction_id      TEXT NOT NULL UNIQUE REFERENCES predictions(id),
    settlement_id      TEXT NOT NULL UNIQUE REFERENCES outcome_settlements(id),
    grading_spec_id    TEXT NOT NULL REFERENCES evaluation_specs(id),
    brier_loss         REAL NOT NULL,
    log_loss           REAL NOT NULL,
    skill_vs_market    REAL NOT NULL,
    hit_miss           TEXT NOT NULL,
    created_at         TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS anchor_events (
    id                  TEXT PRIMARY KEY,
    chain_seq           INTEGER UNIQUE REFERENCES chain_rows(chain_seq),
    chain_head_seq      INTEGER NOT NULL,
    chain_head_hash     TEXT NOT NULL,
    anchor_medium       TEXT NOT NULL,
    anchor_reference    TEXT,
    commit_sha          TEXT,
    status              TEXT NOT NULL,
    details_json        TEXT,
    created_at          TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS anchor_alerts (
    id          TEXT PRIMARY KEY,
    event_id    TEXT REFERENCES anchor_events(id),
    alert_type  TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );
`)

ensureColumn('anchor_events', 'push_status', "push_status TEXT")
ensureColumn('anchor_events', 'push_retries', "push_retries INTEGER")
ensureColumn('anchor_events', 'remote_verified', "remote_verified INTEGER")
ensureColumn('anchor_events', 'github_url', "github_url TEXT")
ensureColumn('prediction_runs', 'stream', "stream TEXT NOT NULL DEFAULT 'research'")
ensureColumn('predictions', 'stream', "stream TEXT NOT NULL DEFAULT 'research'")

db.exec(`
  UPDATE prediction_runs
  SET stream = 'research'
  WHERE stream IS NULL OR trim(stream) = '';

  UPDATE predictions
  SET stream = 'research'
  WHERE stream IS NULL OR trim(stream) = '';
`)

console.log('[db] SQLite initialized:', DB_PATH)
