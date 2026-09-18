import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Scan } from '../data/types'
import { formatDate } from '../lib/format'

/** Stacked bar chart of change counts per scan (oldest → newest). */
export function ChangesChart({ scans }: { scans: Scan[] }) {
  const data = [...scans]
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .map((s) => ({
      name: formatDate(s.completedAt),
      New: s.changeCounts.new,
      Changed: s.changeCounts.changed,
      Removed: s.changeCounts.removed,
    }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'currentColor' }} opacity={0.7} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'currentColor' }} opacity={0.7} />
        <Tooltip
          contentStyle={{
            background: 'var(--color-base-100)',
            border: '1px solid var(--color-base-300)',
            borderRadius: '0.5rem',
            color: 'var(--color-base-content)',
            fontSize: 12,
          }}
          cursor={{ fill: 'currentColor', opacity: 0.06 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="New" stackId="a" fill="oklch(0.72 0.15 150)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Changed" stackId="a" fill="oklch(0.78 0.16 75)" />
        <Bar dataKey="Removed" stackId="a" fill="oklch(0.65 0.2 25)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
