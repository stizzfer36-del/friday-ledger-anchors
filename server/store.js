import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dir, 'data')
const PICKS_FILE = join(DATA_DIR, 'picks.json')
const BANKROLL_FILE = join(DATA_DIR, 'bankroll.json')
const ALERTS_FILE = join(DATA_DIR, 'alerts.json')

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

function loadJSON(file, fallback) {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback
  } catch { return fallback }
}

function saveJSON(file, data) {
  try { writeFileSync(file, JSON.stringify(data, null, 2)) } catch (e) { console.error('[store] save error', e.message) }
}

// ── Live data (in-memory, rebuilt on each refresh) ──────────────────────────
const live = {
  lines: [],              // enriched PrizePicks lines with EV scores
  nbaPlayerMap: {},       // name (lowercase) → { nbaId, name }
  gameLogCache: {},       // nbaId → { logs: [...], fetchedAt }
  injuryMap: {},          // playerName (lowercase) → { status, reason, updatedAt }
  lineHistory: {},        // `${playerName}|${statType}` → [{ line, timestamp }] (last 10)
  lastRefresh: {
    lines: null,
    injuries: null,
    nbaStats: null,
  },
}

// ── Persisted data ───────────────────────────────────────────────────────────
const persisted = {
  picks: loadJSON(PICKS_FILE, []),
  bankroll: loadJSON(BANKROLL_FILE, []),
  alerts: loadJSON(ALERTS_FILE, []),
}

// ── Mutators ─────────────────────────────────────────────────────────────────
export function setLiveLines(lines) { live.lines = lines }
export function getLiveLines() { return live.lines }

export function setNBAPlayerMap(map) { live.nbaPlayerMap = map }
export function getNBAPlayerMap() { return live.nbaPlayerMap }

export function setGameLogCache(id, logs) {
  live.gameLogCache[id] = { logs, fetchedAt: Date.now() }
}
export function getGameLogCache(id) { return live.gameLogCache[id] || null }
export function isGameLogStale(id, maxAgeMs = 6 * 60 * 60 * 1000) {
  const entry = live.gameLogCache[id]
  return !entry || Date.now() - entry.fetchedAt > maxAgeMs
}

export function setInjuryMap(map) { live.injuryMap = map }
export function getInjuryMap() { return live.injuryMap }
export function getInjuryStatus(name) {
  return live.injuryMap[name.toLowerCase()] || { status: 'unknown', reason: null, updatedAt: null }
}

export function setLastRefresh(key) { live.lastRefresh[key] = new Date().toISOString() }
export function getLastRefresh() { return { ...live.lastRefresh } }

// ── Line movement history ─────────────────────────────────────────────────────
export function recordLineHistory(playerName, statType, line) {
  const key = `${playerName}|${statType}`
  if (!live.lineHistory[key]) live.lineHistory[key] = []
  const history = live.lineHistory[key]
  const last = history[history.length - 1]
  // Only record if line value changed
  if (!last || last.line !== line) {
    history.push({ line, timestamp: new Date().toISOString() })
    if (history.length > 10) history.shift()
  }
}
export function getLineMovement(playerName, statType) {
  const key = `${playerName}|${statType}`
  const history = live.lineHistory[key] || []
  if (history.length < 2) return null
  const earliest = history[0].line
  const current = history[history.length - 1].line
  const delta = current - earliest
  return { delta, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', history }
}

// ── Pick CRUD ─────────────────────────────────────────────────────────────────
export function addPick(pick) {
  persisted.picks.push(pick)
  saveJSON(PICKS_FILE, persisted.picks)
  return pick
}
export function getPicks() { return persisted.picks }
export function updatePickResult(id, result) {
  const pick = persisted.picks.find(p => p.id === id)
  if (!pick) return null
  pick.result = result // 'hit' | 'miss'
  pick.settledAt = new Date().toISOString()
  saveJSON(PICKS_FILE, persisted.picks)
  return pick
}

// ── Bankroll CRUD ─────────────────────────────────────────────────────────────
export function addBankrollEntry(entry) {
  persisted.bankroll.push(entry)
  saveJSON(BANKROLL_FILE, persisted.bankroll)
  return entry
}
export function getBankroll() { return persisted.bankroll }

// ── Alert CRUD ────────────────────────────────────────────────────────────────
export function addAlert(alert) {
  persisted.alerts.push(alert)
  saveJSON(ALERTS_FILE, persisted.alerts)
  return alert
}
export function getAlerts() { return persisted.alerts }
export function deleteAlert(id) {
  persisted.alerts = persisted.alerts.filter(a => a.id !== id)
  saveJSON(ALERTS_FILE, persisted.alerts)
}

// ── Calibration helper ────────────────────────────────────────────────────────
export function getCalibration() {
  const settled = persisted.picks.filter(p => p.result)
  if (!settled.length) return { overall: null, byStatType: {}, bySport: {} }

  const calc = (arr) => {
    const hits = arr.filter(p => p.result === 'hit').length
    return { picks: arr.length, hits, hitRate: hits / arr.length }
  }

  const byStatType = {}
  const bySport = {}

  settled.forEach(p => {
    if (!byStatType[p.statType]) byStatType[p.statType] = []
    byStatType[p.statType].push(p)
    if (!bySport[p.sport]) bySport[p.sport] = []
    bySport[p.sport].push(p)
  })

  return {
    overall: calc(settled),
    byStatType: Object.fromEntries(Object.entries(byStatType).map(([k, v]) => [k, calc(v)])),
    bySport: Object.fromEntries(Object.entries(bySport).map(([k, v]) => [k, calc(v)])),
  }
}
