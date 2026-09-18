import { NavLink, Outlet } from 'react-router-dom'
import { getNotifications, getTargets } from '../data/queries'

function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-semibold">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
      Recon<span className="text-primary">Thing</span>
    </span>
  )
}

export function Layout() {
  const targets = getTargets()
  const notificationCount = getNotifications().length

  return (
    <div className="drawer lg:drawer-open min-h-screen">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content flex flex-col">
        {/* Top navbar */}
        <div className="navbar bg-base-200/60 border-base-300 sticky top-0 z-20 border-b backdrop-blur">
          <div className="flex-none lg:hidden">
            <label htmlFor="app-drawer" className="btn btn-square btn-ghost" aria-label="Open menu">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </label>
          </div>
          <div className="flex-1 lg:hidden">
            <BrandMark />
          </div>
          <div className="hidden flex-1 lg:block" />
          <div className="flex-none gap-2">
            <span className="badge badge-success badge-soft gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-current" />
              Live demo
            </span>
            <div className="avatar avatar-placeholder">
              <div className="bg-neutral text-neutral-content w-9 rounded-full">
                <span className="text-sm">ER</span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>

      {/* Sidebar */}
      <div className="drawer-side z-30">
        <label htmlFor="app-drawer" aria-label="Close menu" className="drawer-overlay" />
        <aside className="bg-base-200 border-base-300 flex min-h-screen w-72 flex-col border-r">
          <div className="border-base-300 border-b px-4 py-4">
            <NavLink to="/">
              <BrandMark />
            </NavLink>
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            <ul className="menu w-full gap-0.5">
              <li className="menu-title">Overview</li>
              <li>
                <NavLink
                  to="/notifications"
                  className={({ isActive }) => (isActive ? 'menu-active' : '')}
                >
                  <BellIcon />
                  Notifications
                  {notificationCount > 0 && (
                    <span className="badge badge-xs badge-warning ml-auto">
                      {notificationCount}
                    </span>
                  )}
                </NavLink>
              </li>
              <li>
                <NavLink to="/" end className={({ isActive }) => (isActive ? 'menu-active' : '')}>
                  <DashIcon />
                  Targets
                </NavLink>
              </li>

              <li className="menu-title mt-2">Tracked webapps</li>
              {targets.map((t) => (
                <li key={t.id}>
                  <NavLink
                    to={`/targets/${t.id}`}
                    className={({ isActive }) => (isActive ? 'menu-active' : '')}
                  >
                    <span className="bg-primary/70 h-2 w-2 shrink-0 rounded-full" />
                    <span className="truncate">{t.name}</span>
                    {t.stats.changed + t.stats.new > 0 && (
                      <span className="badge badge-xs badge-warning ml-auto">
                        {t.stats.changed + t.stats.new}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-base-300 text-base-content/50 border-t p-4 text-xs">
            Demo data · {targets.length} targets tracked
          </div>
        </aside>
      </div>
    </div>
  )
}

function DashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 13h6v6h-6z" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}
