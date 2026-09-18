import type { RunLike } from '../data/types'

export interface RunDiff {
  /** Total number of changes: changed requests + endpoints removed since compare. */
  total: number
  /** IDs of requests in `active` that changed or are newly present vs `compare`. */
  changedRequestIds: Set<string>
  /** IDs of requests in `active` that are new endpoints (absent from `compare`). */
  newRequestIds: Set<string>
}

const key = (r: RunLike['requests'][number]) => `${r.method} ${r.url}`

/** Compare a run against another (the "compare with" run) and describe the changes. */
export function diffRuns(active: RunLike, compare: RunLike): RunDiff {
  const aByKey = new Map(active.requests.map((r) => [key(r), r]))
  const bByKey = new Map(compare.requests.map((r) => [key(r), r]))

  const changedRequestIds = new Set<string>()
  const newRequestIds = new Set<string>()
  for (const [k, ra] of aByKey) {
    const rb = bByKey.get(k)
    if (!rb) {
      changedRequestIds.add(ra.id) // endpoint added since compare run
      newRequestIds.add(ra.id)
      continue
    }
    if (
      ra.status !== rb.status ||
      (ra.requestBody ?? '') !== (rb.requestBody ?? '') ||
      (ra.responseBody ?? '') !== (rb.responseBody ?? '')
    ) {
      changedRequestIds.add(ra.id)
    }
  }

  let removed = 0
  for (const k of bByKey.keys()) if (!aByKey.has(k)) removed += 1

  return { total: changedRequestIds.size + removed, changedRequestIds, newRequestIds }
}
