// Small formatting helpers shared across pages.

const REFERENCE_NOW = new Date('2026-09-17T02:00:00Z').getTime()

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** YYYY-MM-DD (UTC). */
export function formatDateISO(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

/** e.g. "3 hours ago", "2 days ago". Relative to the demo's reference "now". */
export function formatRelative(iso: string): string {
  const diffMs = REFERENCE_NOW - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}
