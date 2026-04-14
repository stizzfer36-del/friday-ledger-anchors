import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../../models/db.js'
import { appendChainRow, getChainHead } from './chain.js'

const REMOTE_NAME = 'anchor-remote'
const REMOTE_BRANCH = 'main'
const GITHUB_REPO = 'stizzfer36-del/friday-ledger-anchors'

function resolveAnchorRepo() {
  return process.env.LEDGER_ANCHOR_REPO || path.resolve(process.cwd())
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function pushWithRetry(repoPath) {
  const delays = [1000, 4000, 16000]
  let lastError = null

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      execFileSync('git', ['-C', repoPath, 'push', REMOTE_NAME, `main:${REMOTE_BRANCH}`], { stdio: 'pipe' })
      return { success: true, retries: attempt }
    } catch (err) {
      lastError = err.message
      if (attempt < delays.length) {
        await sleep(delays[attempt])
      }
    }
  }

  return { success: false, retries: delays.length, error: lastError }
}

function verifyRemoteHead(repoPath, localSha) {
  try {
    const output = execFileSync(
      'git',
      ['-C', repoPath, 'ls-remote', REMOTE_NAME, REMOTE_BRANCH],
      { encoding: 'utf8' }
    ).trim()
    const remoteSha = output.split(/\s+/)[0]
    return { verified: remoteSha === localSha, remoteSha, localSha }
  } catch (err) {
    return { verified: false, remoteSha: null, localSha, error: err.message }
  }
}

function recordAlert(eventId, alertType, message, createdAt) {
  console.error(`[anchor ALERT] ${alertType}: ${message}`)
  db.prepare(`
    INSERT INTO anchor_alerts (id, event_id, alert_type, message, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), eventId, alertType, message, createdAt)
}

export async function anchorChainHead() {
  const head = getChainHead()
  const createdAt = new Date().toISOString()
  const repoPath = resolveAnchorRepo()
  const anchorDir = path.join(repoPath, '.ledger-anchors')
  if (!existsSync(anchorDir)) mkdirSync(anchorDir, { recursive: true })

  const manifest = {
    anchoredAt: createdAt,
    chainHeadSeq: head.chain_seq,
    chainHeadHash: head.row_hash,
  }

  const manifestName = `${createdAt.replace(/[:.]/g, '-')}.json`
  const manifestPath = path.join(anchorDir, manifestName)
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  let status = 'manifest_written'
  let commitSha = null
  let pushStatus = null
  let pushRetries = null
  let remoteVerified = null
  let githubUrl = null
  let details = { repoPath, manifestPath }

  try {
    execFileSync('git', ['-C', repoPath, 'add', manifestPath], { stdio: 'ignore' })
    execFileSync('git', ['-C', repoPath, 'commit', '-m', `ledger anchor ${manifest.chainHeadSeq}`], { stdio: 'ignore' })
    commitSha = execFileSync('git', ['-C', repoPath, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    status = 'committed_local'
    githubUrl = `https://github.com/${GITHUB_REPO}/commit/${commitSha}`
  } catch (error) {
    details.gitError = error.message
  }

  // Push with retry — failure is non-fatal, next cycle will catch up
  if (commitSha) {
    const pushResult = await pushWithRetry(repoPath)
    pushStatus = pushResult.success ? 'pushed' : 'push_failed'
    pushRetries = pushResult.retries

    if (pushResult.success) {
      status = 'pushed'

      const verifyResult = verifyRemoteHead(repoPath, commitSha)
      remoteVerified = verifyResult.verified ? 1 : 0

      if (!verifyResult.verified) {
        details.divergence = verifyResult
      }
    } else {
      console.error(`[anchor] Push failed after ${pushResult.retries} retries: ${pushResult.error}`)
      details.pushError = pushResult.error
    }
  }

  const row = appendChainRow({
    rowType: 'anchor_event',
    createdAt,
    payload: {
      chainHeadSeq: head.chain_seq,
      chainHeadHash: head.row_hash,
      anchorMedium: 'github_git_commit',
      anchorReference: manifestPath,
      commitSha,
      githubUrl,
      status,
      pushStatus,
    },
  })

  const id = uuidv4()
  db.prepare(`
    INSERT INTO anchor_events (
      id, chain_seq, chain_head_seq, chain_head_hash, anchor_medium,
      anchor_reference, commit_sha, status, details_json, created_at,
      push_status, push_retries, remote_verified, github_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    row.chainSeq,
    head.chain_seq,
    head.row_hash,
    'github_git_commit',
    manifestPath,
    commitSha,
    status,
    JSON.stringify(details),
    createdAt,
    pushStatus,
    pushRetries,
    remoteVerified,
    githubUrl
  )

  // Alert if remote diverged after successful push
  if (remoteVerified === 0) {
    recordAlert(id, 'remote_diverged',
      `Local HEAD ${commitSha} does not match remote after push — remote may have been rewritten`,
      createdAt
    )
  }

  return db.prepare('SELECT * FROM anchor_events WHERE id = ?').get(id)
}
