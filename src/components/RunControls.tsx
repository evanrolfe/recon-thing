import type { RunLike } from '../data/types'
import { formatDate, formatDateTime } from '../lib/format'

/** "Run" + "Compare with Run" selectors, shared by the flow and page views. */
export function RunControls({
  runs,
  activeScanId,
  compareScanId,
  changeCount,
  onRun,
  onCompare,
}: {
  runs: RunLike[] // newest first
  activeScanId: string
  compareScanId: string
  changeCount: number | null
  onRun: (scanId: string) => void
  onCompare: (scanId: string) => void
}) {
  const activeRun = runs.find((r) => r.scanId === activeScanId)
  if (!activeRun) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Run selector */}
      <label className="flex flex-col">
        <span className="text-base-content/50 mb-1 text-xs uppercase tracking-wide">Run</span>
        <select
          className="select select-sm w-full"
          value={activeRun.scanId}
          onChange={(e) => onRun(e.target.value)}
        >
          {runs.map((r, i) => (
            <option key={r.id} value={r.scanId}>
              {formatDate(r.timestamp)}
              {i === 0 ? ' (latest)' : ''}
            </option>
          ))}
        </select>
        <span className="text-base-content/50 mt-1 text-xs">
          Executed {formatDateTime(activeRun.timestamp)}
        </span>
      </label>

      {/* Compare-with selector */}
      <label className="flex flex-col">
        <span className="text-base-content/50 mb-1 text-xs uppercase tracking-wide">
          Compare with Run:
        </span>
        <div className="flex items-center gap-3">
          <select
            className="select select-sm w-full"
            value={compareScanId}
            onChange={(e) => onCompare(e.target.value)}
          >
            <option value="">None</option>
            {runs
              .filter((r) => r.id !== activeRun.id)
              .map((r) => (
                <option key={r.id} value={r.scanId}>
                  {formatDate(r.timestamp)}
                  {r.id === runs[0]?.id ? ' (latest)' : ''}
                </option>
              ))}
          </select>
          {changeCount != null && (
            <span
              className={`badge whitespace-nowrap ${
                changeCount ? 'badge-warning badge-soft' : 'badge-ghost'
              }`}
            >
              {changeCount} change{changeCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </label>
    </div>
  )
}
