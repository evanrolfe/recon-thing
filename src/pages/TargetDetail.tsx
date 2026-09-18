import { Link, useNavigate, useParams } from 'react-router-dom'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { ChangesChart } from '../components/ChangesChart'
import { FlowStatusBadge, StatBadges } from '../components/badges'
import {
  countRunsForFlow,
  getFlowsForTarget,
  getPagesForTarget,
  getScansForTarget,
  getTarget,
  getVariantsForFlow,
} from '../data/queries'
import { formatDate, formatDateTime, formatRelative } from '../lib/format'

export function TargetDetail() {
  const { targetId = '' } = useParams()
  const navigate = useNavigate()
  const target = getTarget(targetId)

  if (!target) {
    return <NotFound />
  }

  const scans = getScansForTarget(targetId)
  const latestScan = scans[0]
  const flows = getFlowsForTarget(targetId)
  const pages = getPagesForTarget(targetId)

  // Sort so the interesting ones (new/changed/removed) float to the top.
  const statusOrder = { new: 0, changed: 1, removed: 2, unchanged: 3 } as const
  const sortedFlows = [...flows].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name),
  )
  const sortedPages = [...pages].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status] || a.path.localeCompare(b.path),
  )

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Targets', to: '/' }, { label: target.name }]} />

      {/* Overview card */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{target.name}</h1>
              <a
                href={target.url}
                target="_blank"
                rel="noreferrer"
                className="link link-hover text-primary font-mono text-sm"
              >
                {target.url}
              </a>
            </div>
          </div>

          <div className="divider my-1" />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Tracked since" value={formatDate(target.createdAt)} />
            <Stat label="Flows observed" value={String(flows.length)} />
            <Stat label="Scans" value={String(scans.length)} />
            <Stat label="Last scan" value={formatRelative(target.lastScanAt)} />
          </div>
        </div>
      </div>

      {/* Latest scan card */}
      {latestScan && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="card-title text-lg">Latest scan</h2>
                <p className="text-base-content/60 text-sm">
                  Completed {formatDateTime(latestScan.completedAt)} ·{' '}
                  <span className="badge badge-xs badge-success badge-soft">
                    {latestScan.status}
                  </span>
                </p>
              </div>
              <StatBadges stats={latestScan.changeCounts} size="md" />
            </div>

            <div className="divider my-1" />

            <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <div className="grid grid-cols-2 content-start gap-4">
                <Stat label="Flows in scan" value={String(latestScan.flowCount)} />
                <Stat label="Duration" value="~18 min" />
                <Stat
                  label="Behavioural changes"
                  value={String(
                    latestScan.changeCounts.new +
                      latestScan.changeCounts.changed +
                      latestScan.changeCounts.removed,
                  )}
                />
                <Stat label="Status" value={latestScan.status} />
              </div>
              <div>
                <div className="text-base-content/60 mb-1 text-xs font-medium uppercase tracking-wide">
                  Changes per scan
                </div>
                <ChangesChart scans={scans} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pages crawled (collapsed by default) */}
      <details className="collapse-arrow bg-base-200 collapse shadow-sm">
        <summary className="collapse-title flex items-center gap-2 font-semibold">
          Pages crawled
          <span className="badge badge-sm badge-ghost">{pages.length}</span>
        </summary>
        <div className="collapse-content px-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Status</th>
                  <th>API requests</th>
                  <th className="text-right"></th>
                </tr>
              </thead>
              <tbody>
                {sortedPages.map((page) => (
                  <tr
                    key={page.id}
                    className="hover:bg-base-300/40 cursor-pointer"
                    onClick={() => navigate(`/targets/${targetId}/pages/${page.id}`)}
                  >
                    <td className="font-mono text-sm break-all">{page.path}</td>
                    <td>
                      <FlowStatusBadge status={page.status} />
                    </td>
                    <td>{page.apiRequestCount}</td>
                    <td className="text-right">
                      <Link
                        to={`/targets/${targetId}/pages/${page.id}`}
                        className="btn btn-ghost btn-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {/* Flows table */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="text-lg font-semibold">Flows observed in this scan</h2>
            <span className="text-base-content/50 text-sm">{flows.length} flows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Flow</th>
                  <th>Status</th>
                  <th>Variants</th>
                  <th>Runs</th>
                  <th className="text-right"></th>
                </tr>
              </thead>
              <tbody>
                {sortedFlows.map((flow) => {
                  const variantCount = getVariantsForFlow(flow.id).length
                  return (
                    <tr
                      key={flow.id}
                      className="hover:bg-base-300/40 cursor-pointer"
                      onClick={() => navigate(`/targets/${targetId}/flows/${flow.id}`)}
                    >
                      <td>
                        <div className="font-medium">{flow.name}</div>
                        <div className="text-base-content/60 text-xs">{flow.description}</div>
                      </td>
                      <td>
                        <FlowStatusBadge status={flow.status} />
                      </td>
                      <td>{variantCount}</td>
                      <td>{countRunsForFlow(flow.id)}</td>
                      <td className="text-right">
                        <Link
                          to={`/targets/${targetId}/flows/${flow.id}`}
                          className="btn btn-ghost btn-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base-content/50 text-xs uppercase tracking-wide">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="hero bg-base-200 rounded-box py-16">
      <div className="hero-content text-center">
        <div>
          <h1 className="text-xl font-semibold">Not found</h1>
          <p className="text-base-content/60 mt-2">That item doesn't exist in the demo data.</p>
          <Link to="/" className="btn btn-primary btn-sm mt-4">
            Back to targets
          </Link>
        </div>
      </div>
    </div>
  )
}
