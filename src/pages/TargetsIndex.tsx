import { useNavigate } from 'react-router-dom'
import { StatBadges } from '../components/badges'
import { getTargets } from '../data/queries'
import { formatDateTime, formatRelative } from '../lib/format'

export function TargetsIndex() {
  const targets = getTargets()
  const navigate = useNavigate()

  const totals = targets.reduce(
    (acc, t) => {
      acc.new += t.stats.new
      acc.changed += t.stats.changed
      acc.removed += t.stats.removed
      return acc
    },
    { new: 0, changed: 0, removed: 0 },
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Targets</h1>
          <p className="text-base-content/60 mt-1 text-sm">
            Webapps tracked by ReconThing. Change counts are from the most recent scan.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm">
          + Add target
        </button>
      </div>

      {/* Summary stats */}
      <div className="stats stats-vertical sm:stats-horizontal bg-base-200 w-full shadow-sm">
        <div className="stat">
          <div className="stat-title">Tracked webapps</div>
          <div className="stat-value text-primary">{targets.length}</div>
          <div className="stat-desc">across staging &amp; production</div>
        </div>
        <div className="stat">
          <div className="stat-title">New flows</div>
          <div className="stat-value text-success">{totals.new}</div>
          <div className="stat-desc">since previous scan</div>
        </div>
        <div className="stat">
          <div className="stat-title">Changed flows</div>
          <div className="stat-value text-warning">{totals.changed}</div>
          <div className="stat-desc">behavioural differences</div>
        </div>
        <div className="stat">
          <div className="stat-title">Removed flows</div>
          <div className="stat-value text-error">{totals.removed}</div>
          <div className="stat-desc">no longer observed</div>
        </div>
      </div>

      <div className="card bg-base-200 shadow-sm">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Webapp</th>
                  <th>Last scan</th>
                  <th>Changes</th>
                  <th className="text-right"></th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-base-300/40 cursor-pointer"
                    onClick={() => navigate(`/targets/${t.id}`)}
                  >
                    <td>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-base-content/60 font-mono text-xs">{t.url}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.tags.map((tag) => (
                          <span key={tag} className="badge badge-xs badge-ghost">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">{formatDateTime(t.lastScanAt)}</div>
                      <div className="text-base-content/50 text-xs">
                        {formatRelative(t.lastScanAt)}
                      </div>
                    </td>
                    <td>
                      <StatBadges stats={t.stats} />
                    </td>
                    <td className="text-right">
                      <span className="text-base-content/40">›</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
