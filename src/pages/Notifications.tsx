import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlowStatusBadge } from '../components/badges'
import { getNotifications } from '../data/queries'
import { formatDateISO } from '../lib/format'

export function Notifications() {
  const notifications = getNotifications()
  const navigate = useNavigate()
  const [read, setRead] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setRead((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const unread = notifications.filter((n) => !read.has(n.id)).length
  const allRead = notifications.length > 0 && read.size === notifications.length

  function toggleAll() {
    setRead(allRead ? new Set() : new Set(notifications.map((n) => n.id)))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-base-content/60 mt-1 text-sm">
          Behavioural changes observed across all targets. {unread} unread of{' '}
          {notifications.length}.
        </p>
      </div>

      <div className="card bg-base-200 shadow-sm">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-8">
                    <span className="tooltip tooltip-right tooltip-primary" data-tip="Mark all as read">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm rounded-none"
                        checked={allRead}
                        ref={(el) => {
                          if (el) el.indeterminate = unread > 0 && unread < notifications.length
                        }}
                        onChange={toggleAll}
                        aria-label="Mark all as read"
                      />
                    </span>
                  </th>
                  <th>Target</th>
                  <th>Source</th>
                  <th>Change</th>
                  <th>From</th>
                  <th>To</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => {
                  const isRead = read.has(n.id)
                  return (
                    <tr
                      key={n.id}
                      className={`hover:bg-base-300/40 cursor-pointer ${isRead ? 'opacity-50' : ''}`}
                      onClick={() => navigate(n.href)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm rounded-none"
                          checked={isRead}
                          onChange={() => toggle(n.id)}
                          aria-label="Mark as read"
                        />
                      </td>
                      <td className="font-medium">{n.targetName}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            className={`badge badge-sm badge-soft ${
                              n.source === 'flow' ? 'badge-info' : 'badge-secondary'
                            }`}
                          >
                            {n.source}
                          </span>
                          <span className="font-mono text-sm">{n.name}</span>
                        </div>
                      </td>
                      <td>
                        <FlowStatusBadge status={n.status} />
                      </td>
                      <td className="font-mono text-sm">
                        {n.fromDate ? formatDateISO(n.fromDate) : '—'}
                      </td>
                      <td className="font-mono text-sm">
                        {n.toDate ? formatDateISO(n.toDate) : '—'}
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
