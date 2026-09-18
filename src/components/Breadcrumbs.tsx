import { Link } from 'react-router-dom'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <div className="breadcrumbs text-sm">
      <ul>
        {items.map((c, i) => (
          <li key={i}>
            {c.to ? (
              <Link to={c.to} className="link link-hover">
                {c.label}
              </Link>
            ) : (
              <span className="text-base-content/60">{c.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
