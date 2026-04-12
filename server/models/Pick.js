// Per-user pick persistence and calibration queries

import { db } from './db.js'
import { v4 as uuidv4 } from 'uuid'

export function addUserPick(userId, pick) {
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO user_picks
      (id, userId, lineId, playerName, team, statType, line, projection, evScore,
       recommendation, sport, entryAmount, direction, result, settledAt, loggedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, null, ?)
  `).run(
    id, userId, pick.lineId || null, pick.playerName, pick.team || null,
    pick.statType, pick.line, pick.projection || null, pick.evScore || null,
    pick.recommendation || null, pick.sport || 'NBA',
    pick.entryAmount || 0, pick.direction || null, now
  )
  return getUserPickById(id)
}

export function getUserPickById(id) {
  return db.prepare('SELECT * FROM user_picks WHERE id = ?').get(id) || null
}

export function getUserPicks(userId, { result, sport } = {}) {
  let q = 'SELECT * FROM user_picks WHERE userId = ?'
  const params = [userId]
  if (result) { q += ' AND result = ?'; params.push(result) }
  if (sport)  { q += ' AND sport = ?'; params.push(sport) }
  q += ' ORDER BY loggedAt DESC'
  return db.prepare(q).all(...params)
}

export function settleUserPick(userId, pickId, result) {
  const pick = db.prepare('SELECT * FROM user_picks WHERE id = ? AND userId = ?').get(pickId, userId)
  if (!pick) return null
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE user_picks SET result = ?, settledAt = ? WHERE id = ? AND userId = ?
  `).run(result, now, pickId, userId)
  return db.prepare('SELECT * FROM user_picks WHERE id = ?').get(pickId)
}

/**
 * Calibration matrix for a user.
 * Groups settled picks by sport and statType, computes hit rate per bucket.
 *
 * Returns:
 * {
 *   overall: { picks, hits, hitRate },
 *   byStatType: { [statType]: { picks, hits, hitRate } },
 *   bySport: { [sport]: { picks, hits, hitRate } },
 * }
 */
export function getUserCalibration(userId) {
  const settled = db.prepare(
    "SELECT * FROM user_picks WHERE userId = ? AND result IS NOT NULL"
  ).all(userId)

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
