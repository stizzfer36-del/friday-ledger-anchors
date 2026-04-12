// Defense Rankings Service
// Hardcoded 2024-25 season defensive rankings (rank 1 = best defense).
// Formula: pctile = (rank-1)/(total-1), adjustment = (pctile - 0.5) * 0.24
// Best defense (rank 1) → -12% on projection; worst defense → +12%

const NBA_DEFENSE = {
  // Rank 1 = best defense vs opposing scorer
  OKC: 1, BOS: 2, MIN: 3, CLE: 4, MIL: 5,
  IND: 6, NYK: 7, MIA: 8, DEN: 9, HOU: 10,
  NOP: 11, GSW: 12, PHI: 13, LAC: 14, TOR: 15,
  CHI: 16, UTA: 17, ORL: 18, PHX: 19, POR: 20,
  DET: 21, BKN: 22, LAL: 23, DAL: 24, MEM: 25,
  CHA: 26, WAS: 27, SAS: 28, ATL: 29, SAC: 30,
}

const NFL_DEFENSE = {
  // Rank 1 = best defense (fewest points/yards allowed)
  BAL: 1, SF: 2, PIT: 3, NYJ: 4, DAL: 5,
  MIA: 6, DEN: 7, BUF: 8, KC: 9, PHI: 10,
  CLE: 11, LAC: 12, GB: 13, DET: 14, HOU: 15,
  NE: 16, MIN: 17, SEA: 18, TB: 19, NO: 20,
  LV: 21, NYG: 22, JAX: 23, CHI: 24, CIN: 25,
  LAR: 26, IND: 27, ATL: 28, ARI: 29, TEN: 30,
  WAS: 31, CAR: 32,
}

const MLB_DEFENSE = {
  // Rank 1 = stingiest pitching (hardest to score against)
  ATL: 1, LAD: 2, NYM: 3, CHC: 4, SD: 5,
  TB: 6, BAL: 7, HOU: 8, CLE: 9, NYY: 10,
  BOS: 11, MIL: 12, SEA: 13, PHI: 14, SF: 15,
  MIN: 16, CIN: 17, TOR: 18, DET: 19, PIT: 20,
  STL: 21, TEX: 22, ARI: 23, WSH: 24, OAK: 25,
  CWS: 26, LAA: 27, KC: 28, MIA: 29, COL: 30,
}

const NHL_DEFENSE = {
  // Rank 1 = best defensive team (fewest goals against)
  BOS: 1, NYR: 2, DAL: 3, FLA: 4, VGK: 5,
  CAR: 6, TBL: 7, MIN: 8, NJD: 9, STL: 10,
  LAK: 11, NSH: 12, WSH: 13, NYI: 14, ANA: 15,
  DET: 16, PHI: 17, SEA: 18, VAN: 19, PIT: 20,
  WPG: 21, OTT: 22, CBJ: 23, CGY: 24, MTL: 25,
  TOR: 26, SJS: 27, EDM: 28, BUF: 29, COL: 30,
  ARI: 31, CHI: 32,
}

const TOTALS = { NBA: 30, NFL: 32, MLB: 30, NHL: 32 }
const RANKING_MAPS = { NBA: NBA_DEFENSE, NFL: NFL_DEFENSE, MLB: MLB_DEFENSE, NHL: NHL_DEFENSE }

/**
 * Returns a projection multiplier based on opponent defensive ranking.
 * Positive adjustment = playing a weak defense (boost projection).
 * Negative adjustment = playing a strong defense (reduce projection).
 *
 * @param {string} opponentAbbr - e.g. 'BOS', 'KC'
 * @param {string} sport - 'NBA' | 'NFL' | 'MLB' | 'NHL'
 * @returns {{ multiplier: number, rank: number|null, total: number, grade: string, pct: number }}
 */
export function getDefenseAdjustment(opponentAbbr, sport) {
  const map = RANKING_MAPS[sport]
  const total = TOTALS[sport]

  if (!map || !opponentAbbr) {
    return { multiplier: 1.0, rank: null, total, grade: 'C', pct: 0, adjustment: 0 }
  }

  const rank = map[opponentAbbr?.toUpperCase()]
  if (!rank) {
    return { multiplier: 1.0, rank: null, total, grade: 'C', pct: 0, adjustment: 0 }
  }

  const pctile = (rank - 1) / (total - 1)         // 0 = best defense, 1 = worst
  const adjustment = (pctile - 0.5) * 0.24         // -12% to +12%
  const multiplier = 1 + adjustment

  const grade = gradeDefense(rank, total)

  return {
    multiplier: parseFloat(multiplier.toFixed(4)),
    rank,
    total,
    grade,
    pct: parseFloat((adjustment * 100).toFixed(1)),
    adjustment: parseFloat((adjustment * 100).toFixed(1)),
  }
}

function gradeDefense(rank, total) {
  const pctile = rank / total
  if (pctile <= 0.10) return 'A+'
  if (pctile <= 0.20) return 'A'
  if (pctile <= 0.33) return 'B'
  if (pctile <= 0.50) return 'C'
  if (pctile <= 0.67) return 'D'
  if (pctile <= 0.80) return 'F'
  return 'F-'
}
