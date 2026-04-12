import { clsx } from 'clsx'

const CONFIG = {
  STRONG:  { cls: 'ev-strong',  label: 'STRONG'  },
  GOOD:    { cls: 'ev-good',    label: 'GOOD'    },
  LEAN:    { cls: 'ev-lean',    label: 'LEAN'    },
  NEUTRAL: { cls: 'ev-neutral', label: 'NEUTRAL' },
  FADE:    { cls: 'ev-fade',    label: 'FADE'    },
  SKIP:    { cls: 'ev-skip',    label: 'SKIP'    },
}

export function EVBadge({ recommendation, evScore, compact = false }) {
  const cfg = CONFIG[recommendation] || CONFIG.NEUTRAL
  const sign = evScore > 0 ? '+' : ''

  return (
    <span className={cfg.cls}>
      {cfg.label}
      {!compact && evScore != null && (
        <span className="ml-1 opacity-75">{sign}{evScore}</span>
      )}
    </span>
  )
}

export function InjuryBadge({ status, reason }) {
  const dotClass = {
    healthy:      'inj-healthy',
    probable:     'inj-probable',
    questionable: 'inj-questionable',
    doubtful:     'inj-doubtful',
    out:          'inj-out',
    unknown:      'inj-unknown',
  }[status] || 'inj-unknown'

  const label = {
    healthy:      'Healthy',
    probable:     'Probable',
    questionable: reason ? `Q — ${reason}` : 'Questionable',
    doubtful:     reason ? `D — ${reason}` : 'Doubtful',
    out:          reason ? `OUT — ${reason}` : 'Out',
    unknown:      'Status unknown',
  }[status] || 'Unknown'

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className={dotClass} />
      {label}
    </span>
  )
}

export function TrendBadge({ trend, delta, compact = false }) {
  if (!trend || trend === 'neutral') return null
  const hot = trend === 'hot'
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold',
      hot ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25'
          : 'bg-sky-500/15 text-sky-400 border border-sky-500/25'
    )}>
      {hot ? '🔥' : '❄️'}
      {!compact && <>{hot ? 'HOT' : 'COLD'}</>}
      {!compact && delta != null && <span className="opacity-70 ml-0.5">{hot ? '+' : ''}{delta}</span>}
    </span>
  )
}

export function LineValueBadge({ lineValue, compact = false }) {
  if (!lineValue || lineValue === 'fair') return null
  return (
    <span className={clsx(
      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
      lineValue === 'soft'  ? 'bg-ev-good/15 text-ev-good border border-ev-good/25' :
      lineValue === 'tight' ? 'bg-slate-500/15 text-slate-400 border border-slate-500/20' : ''
    )}>
      {compact
        ? lineValue === 'soft' ? '↑' : '~'
        : lineValue === 'soft' ? 'SOFT' : 'TIGHT'
      }
    </span>
  )
}

export function ConfBadge({ confidence }) {
  const cls = {
    HIGH:    'conf-high',
    MEDIUM:  'conf-medium',
    LOW:     'conf-low',
    INVALID: 'conf-low',
  }[confidence] || 'conf-low'

  return <span className={cls}>{confidence}</span>
}
