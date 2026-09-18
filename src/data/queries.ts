import { diffRuns } from '../lib/rundiff'
import { db } from './mock'
import type {
  Flow,
  FlowStatus,
  Notification,
  Page,
  PageRun,
  Run,
  RunLike,
  Scan,
  Target,
  Variant,
} from './types'

export function getTargets(): Target[] {
  return db.targets
}

export function getTarget(id: string): Target | undefined {
  return db.targets.find((t) => t.id === id)
}

export function getScan(id: string): Scan | undefined {
  return db.scans.find((s) => s.id === id)
}

export function getScansForTarget(targetId: string): Scan[] {
  // Newest first.
  return db.scans
    .filter((s) => s.targetId === targetId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
}

export function getLatestScan(targetId: string): Scan | undefined {
  return getScansForTarget(targetId)[0]
}

export function getFlowsForTarget(targetId: string): Flow[] {
  return db.flows.filter((f) => f.targetId === targetId)
}

export function getFlow(id: string): Flow | undefined {
  return db.flows.find((f) => f.id === id)
}

export function getVariant(id: string): Variant | undefined {
  return db.variants.find((v) => v.id === id)
}

export function getVariantsForFlow(flowId: string): Variant[] {
  return db.variants.filter((v) => v.flowId === flowId)
}

export function getRunsForVariant(variantId: string): Run[] {
  // Newest first.
  return db.runs
    .filter((r) => r.variantId === variantId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

/** The run of a variant that belongs to a given scan, if any. */
export function getRunForVariantInScan(variantId: string, scanId: string): Run | undefined {
  return db.runs.find((r) => r.variantId === variantId && r.scanId === scanId)
}

/** Convenience: total number of runs recorded for a flow across all variants. */
export function countRunsForFlow(flowId: string): number {
  const variantIds = new Set(getVariantsForFlow(flowId).map((v) => v.id))
  return db.runs.filter((r) => variantIds.has(r.variantId)).length
}

export function getPagesForTarget(targetId: string): Page[] {
  return db.pages.filter((p) => p.targetId === targetId)
}

export function getPage(id: string): Page | undefined {
  return db.pages.find((p) => p.id === id)
}

export function getPageRunsForPage(pageId: string): PageRun[] {
  // Newest first.
  return db.pageRuns
    .filter((r) => r.pageId === pageId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

/** added / changed / removed request counts for a flow or page given its runs (newest first). */
function changeCounts(
  status: FlowStatus,
  runs: RunLike[],
): { added: number; changed: number; removed: number } {
  if (status === 'new') return { added: runs[0]?.requests.length ?? 0, changed: 0, removed: 0 }
  if (status === 'removed') return { added: 0, changed: 0, removed: runs[0]?.requests.length ?? 0 }
  const [latest, prev] = runs
  if (!latest || !prev) return { added: 0, changed: 0, removed: 0 }
  const d = diffRuns(latest, prev)
  const added = d.newRequestIds.size
  return {
    added,
    changed: d.changedRequestIds.size - added,
    removed: d.total - d.changedRequestIds.size,
  }
}

/** Build one notification from a flow's or page's runs (newest first). */
function buildNotification(
  base: Omit<Notification, 'added' | 'changed' | 'removed' | 'fromDate' | 'toDate' | 'href'>,
  runs: RunLike[],
  linkBase: string,
  scanDates: { fromDate?: string; toDate?: string },
): Notification {
  // Open the run that best represents the change, comparing against the older run.
  const toRun = base.status === 'removed' ? undefined : runs[0]
  const fromRun = base.status === 'changed' ? runs[1] : base.status === 'removed' ? runs[0] : undefined
  const activeScanId = (toRun ?? fromRun)?.scanId
  const compareScanId = toRun && fromRun ? fromRun.scanId : undefined
  const params = new URLSearchParams()
  if (activeScanId) params.set('run', activeScanId)
  if (compareScanId) params.set('compare', compareScanId)
  const query = params.toString()

  return {
    ...base,
    ...changeCounts(base.status, runs),
    // From/To are the two scans being compared, which always exist.
    fromDate: scanDates.fromDate,
    toDate: scanDates.toDate,
    href: query ? `${linkBase}?${query}` : linkBase,
  }
}

/** All observed changes (changed / new / removed flows and pages) across every target. */
export function getNotifications(): Notification[] {
  const items: Notification[] = []

  for (const target of db.targets) {
    // The latest two scans are the ones a change is observed between.
    const targetScans = getScansForTarget(target.id) // newest first
    const scanDates = { toDate: targetScans[0]?.completedAt, fromDate: targetScans[1]?.completedAt }

    for (const flow of getFlowsForTarget(target.id)) {
      if (flow.status === 'unchanged') continue
      const variant = getVariantsForFlow(flow.id)[0]
      const runs = variant ? getRunsForVariant(variant.id) : []
      items.push(
        buildNotification(
          {
            id: `flow-${flow.id}`,
            targetId: target.id,
            targetName: target.name,
            source: 'flow',
            name: flow.name,
            status: flow.status,
            observedAt: target.lastScanAt,
          },
          runs,
          `/targets/${target.id}/flows/${flow.id}`,
          scanDates,
        ),
      )
    }

    for (const page of getPagesForTarget(target.id)) {
      if (page.status === 'unchanged') continue
      items.push(
        buildNotification(
          {
            id: `page-${page.id}`,
            targetId: target.id,
            targetName: target.name,
            source: 'page',
            name: page.path,
            status: page.status,
            observedAt: target.lastScanAt,
          },
          getPageRunsForPage(page.id),
          `/targets/${target.id}/pages/${page.id}`,
          scanDates,
        ),
      )
    }
  }

  return items.sort(
    (a, b) =>
      b.observedAt.localeCompare(a.observedAt) ||
      a.targetName.localeCompare(b.targetName) ||
      a.name.localeCompare(b.name),
  )
}
