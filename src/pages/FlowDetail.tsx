import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { RequestDetailPanel, RequestsTable } from '../components/ApiRequests'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { RunControls } from '../components/RunControls'
import { ActionKindTag, FlowStatusBadge } from '../components/badges'
import {
  getFlow,
  getRunForVariantInScan,
  getRunsForVariant,
  getTarget,
  getVariantsForFlow,
} from '../data/queries'
import type { ActionKind } from '../data/types'
import { formatDate } from '../lib/format'
import { diffRuns } from '../lib/rundiff'
import { NotFound } from './TargetDetail'

export function FlowDetail() {
  const { targetId = '', flowId = '' } = useParams()
  const target = getTarget(targetId)
  const flow = getFlow(flowId)
  const variants = useMemo(() => getVariantsForFlow(flowId), [flowId])

  const [variantId, setVariantId] = useState(variants[0]?.id ?? '')
  const activeVariantId = variants.some((v) => v.id === variantId)
    ? variantId
    : variants[0]?.id ?? ''

  const activeVariant = variants.find((v) => v.id === activeVariantId)
  const runs = useMemo(() => getRunsForVariant(activeVariantId), [activeVariantId]) // newest first
  const [searchParams] = useSearchParams()
  const [scanId, setScanId] = useState(() => searchParams.get('run') ?? '')
  const activeRun = runs.find((r) => r.scanId === scanId) ?? runs[0] // default to latest

  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [compareScanId, setCompareScanId] = useState(() => searchParams.get('compare') ?? '')

  if (!target || !flow) return <NotFound />

  const selectedAction = activeRun?.actions.find((a) => a.id === selectedActionId) ?? null
  const visibleRequests = activeRun
    ? selectedAction
      ? activeRun.requests.filter((r) => selectedAction.requestIds.includes(r.id))
      : activeRun.requests
    : []
  const selectedRequest = activeRun?.requests.find((r) => r.id === selectedRequestId) ?? null
  const compareRun =
    compareScanId && activeRun && compareScanId !== activeRun.scanId
      ? runs.find((r) => r.scanId === compareScanId) ?? null
      : null
  const runDiff = activeRun && compareRun ? diffRuns(activeRun, compareRun) : null
  const changedRequestIds = runDiff?.changedRequestIds ?? new Set<string>()
  const newRequestIds = runDiff?.newRequestIds ?? new Set<string>()
  const changeCount = runDiff?.total ?? null

  // Per-variant change counts (active scan vs compare scan) for the variant buttons.
  const variantChangeCounts = new Map<string, number>()
  if (activeRun && compareRun) {
    for (const v of variants) {
      const a = getRunForVariantInScan(v.id, activeRun.scanId)
      const b = getRunForVariantInScan(v.id, compareRun.scanId)
      variantChangeCounts.set(v.id, a && b ? diffRuns(a, b).total : 0)
    }
  }

  // Map each request to the action (step number + kind) that triggered it.
  const actionByRequestId = new Map<string, { step: number; kind: ActionKind }>()
  activeRun?.actions.forEach((a, i) =>
    a.requestIds.forEach((rid) => actionByRequestId.set(rid, { step: i + 1, kind: a.kind })),
  )

  function selectVariant(id: string) {
    setVariantId(id)
    setScanId('') // reset to latest run
    setSelectedActionId(null)
    setSelectedRequestId(null)
    // Keep the comparison scan so per-variant change counts stay visible.
  }

  function selectRun(newScanId: string) {
    setScanId(newScanId)
    setSelectedActionId(null)
    setSelectedRequestId(null)
    setCompareScanId('')
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Targets', to: '/' },
          { label: target.name, to: `/targets/${targetId}` },
          { label: `Flow: ${flow.name}` },
          ...(activeRun
            ? [
                {
                  label: `Run: ${formatDate(activeRun.timestamp)}${
                    runs[0]?.id === activeRun.id ? ' (latest)' : ''
                  }`,
                },
              ]
            : []),
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{flow.name}</h1>
            <FlowStatusBadge status={flow.status} />
          </div>
          <p className="text-base-content/60 mt-1">{flow.description}</p>
        </div>
      </div>

      {/* Run + compare + variant selectors */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body gap-4">
          {activeRun && (
            <RunControls
              runs={runs}
              activeScanId={activeRun.scanId}
              compareScanId={compareScanId}
              changeCount={changeCount}
              onRun={selectRun}
              onCompare={setCompareScanId}
            />
          )}

          {/* Variant selector */}
          <div>
            <div className="text-base-content/50 mb-1.5 text-xs font-medium uppercase tracking-wide">
              Variant
            </div>
            <div role="tablist" className="flex flex-wrap gap-2">
              {variants.map((v) => {
                const vc = variantChangeCounts.get(v.id) ?? 0
                return (
                  <button
                    key={v.id}
                    role="tab"
                    type="button"
                    className={`btn btn-sm btn-outline ${
                      v.id === activeVariantId ? 'btn-primary' : ''
                    }`}
                    onClick={() => selectVariant(v.id)}
                  >
                    {v.name}
                    {vc > 0 && (
                      <span className="text-warning">
                        ({vc} change{vc === 1 ? '' : 's'})
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-base-content/60 mt-2 text-sm">
              {variants.find((v) => v.id === activeVariantId)?.description}
            </p>
          </div>
        </div>
      </div>

      {/* Summary of the variant and its outcome */}
      {activeVariant && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-base-content/50 mb-1.5 text-xs font-medium uppercase tracking-wide">
                Description
              </div>
              <p className="text-sm leading-relaxed">{activeVariant.summary}</p>
            </div>
            <div>
              <div className="text-base-content/50 mb-1.5 text-xs font-medium uppercase tracking-wide">
                Outcome
              </div>
              <p className="text-sm leading-relaxed">{activeVariant.outcome}</p>
            </div>
          </div>
        </div>
      )}

      {activeRun ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            {/* Actions stepper */}
            <div className="card bg-base-200 h-fit shadow-sm">
              <div className="card-body p-0">
                <div className="flex items-center justify-between px-4 pt-4">
                  <h2 className="text-sm font-semibold">
                    Actions{' '}
                    <span className="text-base-content/50">({activeRun.actions.length})</span>
                  </h2>
                  {changeCount != null && changeCount > 0 && (
                    <span className="badge badge-warning badge-soft badge-sm">
                      {changeCount} change{changeCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>

                <ul className="py-2">
                  <li>
                    <button
                      type="button"
                      onClick={() => setSelectedActionId(null)}
                      className={`hover:bg-base-300/40 flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm ${
                        selectedAction === null ? 'bg-base-300/50 font-medium' : ''
                      }`}
                    >
                      All actions
                      <span className="badge badge-xs badge-ghost ml-auto">
                        {activeRun.requests.length} reqs
                      </span>
                    </button>
                  </li>

                  {activeRun.actions.map((action, i) => {
                    const count = action.requestIds.length
                    const isActive = action.id === selectedActionId
                    const actionChanges = action.requestIds.filter((id) =>
                      changedRequestIds.has(id),
                    ).length
                    const rowClass = isActive
                      ? 'bg-primary/10 border-primary border-l-2'
                      : actionChanges > 0
                        ? 'bg-warning/10 border-l-2 border-transparent'
                        : 'border-l-2 border-transparent'
                    return (
                      <li key={action.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedActionId(action.id)}
                          className={`hover:bg-base-300/40 flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left ${rowClass}`}
                        >
                          <span className="bg-base-300 text-base-content/70 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm leading-snug">{action.label}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                              <ActionKindTag kind={action.kind} />
                              {count > 0 ? (
                                <span className="badge badge-xs badge-info badge-soft">
                                  {count} request{count === 1 ? '' : 's'}
                                </span>
                              ) : (
                                <span className="text-base-content/40 text-xs">no requests</span>
                              )}
                              {actionChanges > 0 && (
                                <span className="badge badge-xs badge-warning badge-soft">
                                  {actionChanges} change{actionChanges === 1 ? '' : 's'}
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            {/* Requests table */}
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">API requests</h2>
                    {changeCount != null && changeCount > 0 && (
                      <span className="badge badge-warning badge-soft badge-sm">
                        {changeCount} change{changeCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  {selectedAction ? (
                    <span className="text-base-content/50 flex items-center gap-2 text-sm">
                      <span>
                        Filtered by{' '}
                        <span className="text-base-content font-medium">
                          “{selectedAction.label}”
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-circle"
                        aria-label="Clear filter"
                        onClick={() => setSelectedActionId(null)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </span>
                  ) : (
                    <span className="text-base-content/50 text-sm">
                      {activeRun.requests.length} requests
                    </span>
                  )}
                </div>

                <RequestsTable
                  requests={visibleRequests}
                  selectedRequestId={selectedRequestId}
                  onSelect={setSelectedRequestId}
                  changedRequestIds={changedRequestIds}
                  newRequestIds={newRequestIds}
                  actionByRequestId={actionByRequestId}
                  emptyMessage="This action didn't trigger any API requests."
                />
              </div>
            </div>
          </div>

          {selectedRequest && (
            <RequestDetailPanel
              request={selectedRequest}
              compareRun={compareRun}
              changedRequestIds={changedRequestIds}
              onClose={() => setSelectedRequestId(null)}
            />
          )}
        </>
      ) : (
        <div className="alert alert-info alert-soft">
          <span>No runs recorded for this variant yet.</span>
        </div>
      )}
    </div>
  )
}
