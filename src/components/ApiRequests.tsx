import { useEffect, useRef } from 'react'
import type { ActionKind, CapturedRequest, RunLike } from '../data/types'
import { ActionKindLabel, MethodBadge, StatusCodeBadge } from './badges'
import { RequestResponseCards, RequestResponseCompare } from './RequestResponse'

/** The API requests table, shared by the flow and page views. */
export function RequestsTable({
  requests,
  selectedRequestId,
  onSelect,
  changedRequestIds,
  newRequestIds,
  actionByRequestId,
  emptyMessage,
}: {
  requests: CapturedRequest[]
  selectedRequestId: string | null
  onSelect: (id: string) => void
  changedRequestIds: Set<string>
  newRequestIds: Set<string>
  /** When provided, adds a "Triggered By" column linking requests to actions. */
  actionByRequestId?: Map<string, { step: number; kind: ActionKind }>
  emptyMessage: string
}) {
  if (requests.length === 0) {
    return <div className="text-base-content/50 px-5 py-10 text-center text-sm">{emptyMessage}</div>
  }
  const showTriggeredBy = actionByRequestId != null

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Status</th>
            <th className="text-right">Time</th>
            {showTriggeredBy && <th className="text-right">Triggered By</th>}
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const changed = changedRequestIds.has(r.id)
            const isNew = newRequestIds.has(r.id)
            const selected = r.id === selectedRequestId
            const rowBg = selected ? 'bg-primary/10' : changed ? 'bg-warning/10' : ''
            const act = actionByRequestId?.get(r.id)
            return (
              <tr
                key={r.id}
                className={`hover:bg-base-300/40 cursor-pointer ${rowBg}`}
                onClick={() => onSelect(r.id)}
              >
                <td
                  className={
                    selected ? 'border-l-primary border-l-2' : 'border-l-2 border-l-transparent'
                  }
                >
                  <MethodBadge method={r.method} outline />
                </td>
                <td className="font-mono text-xs break-all">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {r.url}
                    {isNew ? (
                      <span className="badge badge-xs badge-success badge-soft">new</span>
                    ) : (
                      changed && (
                        <span className="badge badge-xs badge-warning badge-soft">changed</span>
                      )
                    )}
                  </span>
                </td>
                <td>
                  <StatusCodeBadge status={r.status} outline />
                </td>
                <td className="text-base-content/60 text-right text-xs">{r.durationMs}ms</td>
                {showTriggeredBy && (
                  <td className="text-right">
                    {act ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="badge badge-xs badge-ghost">{act.step}</span>
                        <ActionKindLabel kind={act.kind} />
                      </span>
                    ) : (
                      <span className="text-base-content/30">—</span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The request/response detail card shown below the table. Shows a side-by-side
 * diff when comparing and the request changed, otherwise the single view.
 */
export function RequestDetailPanel({
  request,
  compareRun,
  changedRequestIds,
  onClose,
}: {
  request: CapturedRequest
  compareRun: RunLike | null
  changedRequestIds: Set<string>
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [request.id])

  const showDiff = compareRun != null && changedRequestIds.has(request.id)
  const counterpart = showDiff
    ? compareRun.requests.find((r) => r.method === request.method && r.url === request.url) ?? null
    : null

  return (
    <div ref={ref} className="card bg-base-200 scroll-mt-4 shadow-sm">
      <div className="card-body">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            <span className="font-mono">
              {request.method} {request.url}
            </span>
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Close"
            onClick={onClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-2">
          {showDiff ? (
            <RequestResponseCompare active={request} compare={counterpart} />
          ) : (
            <RequestResponseCards request={request} />
          )}
        </div>
      </div>
    </div>
  )
}
