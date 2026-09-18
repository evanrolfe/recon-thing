// Domain model for the ReconThing demo. See PROPOSAL.md for the concepts:
// Flow -> Variant -> Run, plus Targets and Scans, and diffs between runs.

export type FlowStatus = 'new' | 'changed' | 'removed' | 'unchanged'

export type ScanStatus = 'completed' | 'running' | 'failed'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** The kind of browser interaction the AI performed while running a variant. */
export type ActionKind =
  | 'navigate'
  | 'fill'
  | 'select'
  | 'click'
  | 'submit'
  | 'confirm'
  | 'wait'

export type DiffKind =
  | 'added-property'
  | 'removed-property'
  | 'changed-value'
  | 'changed-status'
  | 'new-endpoint'
  | 'removed-endpoint'

export interface ChangeCounts {
  new: number
  changed: number
  removed: number
}

export interface Target {
  id: string
  name: string
  url: string
  tags: string[]
  createdAt: string // ISO date
  lastScanAt: string // ISO date
  /** Change counts from the most recent scan, shown as badges on the index. */
  stats: ChangeCounts
  scanIds: string[]
  /** Page paths discovered during the crawl phase. */
  pagesCrawled: string[]
}

export interface Scan {
  id: string
  targetId: string
  startedAt: string
  completedAt: string
  status: ScanStatus
  flowCount: number
  changeCounts: ChangeCounts
}

export interface Flow {
  id: string
  targetId: string
  name: string
  description: string
  status: FlowStatus
  variantIds: string[]
}

export interface Variant {
  id: string
  flowId: string
  name: string
  description: string
  /** One paragraph describing what the AI does in this variant. */
  summary: string
  /** One paragraph describing the observed outcome. */
  outcome: string
  runIds: string[]
}

export interface CapturedRequest {
  id: string
  method: HttpMethod
  url: string
  status: number
  durationMs: number
  requestHeaders: Record<string, string>
  requestBody?: string
  responseHeaders: Record<string, string>
  responseBody?: string
}

export interface DiffEntry {
  kind: DiffKind
  /** e.g. "POST /api/register" or a JSON pointer like "response.body.token" */
  location: string
  before?: string
  after?: string
}

/** A single browser interaction step performed while executing a run. */
export interface Action {
  id: string
  label: string
  kind: ActionKind
  /** IDs of the captured requests this action triggered (may be empty). */
  requestIds: string[]
}

/** The minimal shape shared by anything that captures traffic in one scan. */
export interface RunLike {
  id: string
  scanId: string
  timestamp: string
  requests: CapturedRequest[]
}

export interface Run extends RunLike {
  variantId: string
  /** Ordered interaction steps the AI performed to execute the variant. */
  actions: Action[]
  /** Difference from the previous scan's run of the same variant. */
  diff: DiffEntry[]
}

/** A crawled frontend page and the traffic it produced in one scan. */
export interface PageRun extends RunLike {
  pageId: string
}

export interface Page {
  id: string
  targetId: string
  path: string
  status: FlowStatus
  /** Number of API requests captured on the most recent run of this page. */
  apiRequestCount: number
  runIds: string[]
}

/** A behavioural change observed on a flow or page, shown in the notifications feed. */
export interface Notification {
  id: string
  targetId: string
  targetName: string
  source: 'flow' | 'page'
  /** The flow or page the change was observed on. */
  name: string
  status: FlowStatus
  added: number
  changed: number
  removed: number
  observedAt: string
  /** Dates of the two runs the change was observed between (may be absent). */
  fromDate?: string
  toDate?: string
  /** Link to the flow or page view with the relevant runs pre-selected. */
  href: string
}

export interface Database {
  targets: Target[]
  scans: Scan[]
  flows: Flow[]
  variants: Variant[]
  runs: Run[]
  pages: Page[]
  pageRuns: PageRun[]
}
