import type { ActionKind, ChangeCounts, DiffKind, FlowStatus, HttpMethod } from '../data/types'

/** New / Changed / Removed flow counts, shown on the index and target detail. */
export function StatBadges({ stats, size = 'sm' }: { stats: ChangeCounts; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'badge-md' : 'badge-sm'
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`badge badge-success badge-soft ${cls}`} title="New flows">
        +{stats.new} new
      </span>
      <span className={`badge badge-warning badge-soft ${cls}`} title="Changed flows">
        ~{stats.changed} changed
      </span>
      <span className={`badge badge-error badge-soft ${cls}`} title="Removed flows">
        −{stats.removed} removed
      </span>
    </div>
  )
}

const FLOW_STATUS_STYLES: Record<FlowStatus, string> = {
  new: 'badge-success',
  changed: 'badge-warning',
  removed: 'badge-error',
  unchanged: 'badge-ghost',
}

export function FlowStatusBadge({ status }: { status: FlowStatus }) {
  return <span className={`badge badge-sm ${FLOW_STATUS_STYLES[status]}`}>{status}</span>
}

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: 'badge-info',
  POST: 'badge-success',
  PUT: 'badge-warning',
  PATCH: 'badge-warning',
  DELETE: 'badge-error',
}

export function MethodBadge({ method, outline = false }: { method: HttpMethod; outline?: boolean }) {
  return (
    <span
      className={`badge badge-sm font-mono ${outline ? 'badge-outline' : 'badge-soft'} ${METHOD_STYLES[method]}`}
    >
      {method}
    </span>
  )
}

export function StatusCodeBadge({ status, outline = false }: { status: number; outline?: boolean }) {
  const cls =
    status >= 500
      ? 'badge-error'
      : status >= 400
        ? 'badge-warning'
        : status >= 300
          ? 'badge-info'
          : 'badge-success'
  return (
    <span className={`badge badge-sm font-mono ${outline ? 'badge-outline' : 'badge-soft'} ${cls}`}>
      {status}
    </span>
  )
}

const DIFF_KIND_STYLES: Record<DiffKind, string> = {
  'added-property': 'badge-success',
  'removed-property': 'badge-error',
  'changed-value': 'badge-warning',
  'changed-status': 'badge-warning',
  'new-endpoint': 'badge-success',
  'removed-endpoint': 'badge-error',
}

export function DiffKindBadge({ kind }: { kind: DiffKind }) {
  return (
    <span className={`badge badge-sm badge-soft ${DIFF_KIND_STYLES[kind]}`}>
      {kind.replace(/-/g, ' ')}
    </span>
  )
}

const ACTION_KIND_ICONS: Record<ActionKind, string> = {
  navigate: '🧭',
  fill: '⌨️',
  select: '☑️',
  click: '🖱️',
  submit: '📨',
  confirm: '✅',
  wait: '⏳',
}

export function ActionKindTag({ kind }: { kind: ActionKind }) {
  return (
    <span className="badge badge-xs badge-ghost gap-1 font-mono uppercase" title={kind}>
      <span aria-hidden>{ACTION_KIND_ICONS[kind]}</span>
      {kind}
    </span>
  )
}

/** Icon + Title Case kind label (e.g. "🧭 Navigate"). */
export function ActionKindLabel({ kind }: { kind: ActionKind }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span aria-hidden>{ACTION_KIND_ICONS[kind]}</span>
      <span className="capitalize">{kind}</span>
    </span>
  )
}
