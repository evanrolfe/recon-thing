import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { RequestDetailPanel, RequestsTable } from '../components/ApiRequests'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { RunControls } from '../components/RunControls'
import { FlowStatusBadge } from '../components/badges'
import { getPage, getPageRunsForPage, getTarget } from '../data/queries'
import { formatDate } from '../lib/format'
import { diffRuns } from '../lib/rundiff'
import { NotFound } from './TargetDetail'

export function PageDetail() {
  const { targetId = '', pageId = '' } = useParams()
  const target = getTarget(targetId)
  const page = getPage(pageId)
  const runs = useMemo(() => getPageRunsForPage(pageId), [pageId]) // newest first

  const [searchParams] = useSearchParams()
  const [scanId, setScanId] = useState(() => searchParams.get('run') ?? '')
  const [compareScanId, setCompareScanId] = useState(() => searchParams.get('compare') ?? '')
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)

  if (!target || !page) return <NotFound />

  const activeRun = runs.find((r) => r.scanId === scanId) ?? runs[0] // default to latest
  const selectedRequest = activeRun?.requests.find((r) => r.id === selectedRequestId) ?? null
  const compareRun =
    compareScanId && activeRun && compareScanId !== activeRun.scanId
      ? runs.find((r) => r.scanId === compareScanId) ?? null
      : null
  const runDiff = activeRun && compareRun ? diffRuns(activeRun, compareRun) : null
  const changedRequestIds = runDiff?.changedRequestIds ?? new Set<string>()
  const newRequestIds = runDiff?.newRequestIds ?? new Set<string>()
  const changeCount = runDiff?.total ?? null

  function selectRun(newScanId: string) {
    setScanId(newScanId)
    setSelectedRequestId(null)
    setCompareScanId('')
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Targets', to: '/' },
          { label: target.name, to: `/targets/${targetId}` },
          { label: `Page: ${page.path}` },
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

      <div className="flex items-center gap-2">
        <h1 className="font-mono text-2xl font-semibold">{page.path}</h1>
        <FlowStatusBadge status={page.status} />
      </div>

      {/* Run + compare selectors */}
      {activeRun && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <RunControls
              runs={runs}
              activeScanId={activeRun.scanId}
              compareScanId={compareScanId}
              changeCount={changeCount}
              onRun={selectRun}
              onCompare={setCompareScanId}
            />
          </div>
        </div>
      )}

      {activeRun ? (
        <>
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
                <span className="text-base-content/50 text-sm">
                  {activeRun.requests.length} requests
                </span>
              </div>

              <RequestsTable
                requests={activeRun.requests}
                selectedRequestId={selectedRequestId}
                onSelect={setSelectedRequestId}
                changedRequestIds={changedRequestIds}
                newRequestIds={newRequestIds}
                emptyMessage="No API requests captured on this page."
              />
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
          <span>No runs recorded for this page yet.</span>
        </div>
      )}
    </div>
  )
}
