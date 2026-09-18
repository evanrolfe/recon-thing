import type { CapturedRequest } from '../data/types'
import { MethodBadge, StatusCodeBadge } from './badges'

/** Request details on the left, response details on the right. */
export function RequestResponseCards({ request }: { request: CapturedRequest }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Request */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base-content/60 text-xs font-semibold uppercase tracking-wide">
              Request
            </span>
            <MethodBadge method={request.method} />
          </div>
          <div className="font-mono text-sm break-all">{request.url}</div>

          <Section title="Headers">
            <HeaderTable headers={request.requestHeaders} />
          </Section>
          {request.requestBody && (
            <Section title="Body">
              <CodeBlock text={request.requestBody} />
            </Section>
          )}
        </div>
      </div>

      {/* Response */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base-content/60 text-xs font-semibold uppercase tracking-wide">
              Response
            </span>
            <StatusCodeBadge status={request.status} />
            <span className="text-base-content/50 text-xs">{request.durationMs}ms</span>
          </div>

          <Section title="Headers">
            <HeaderTable headers={request.responseHeaders} />
          </Section>
          {request.responseBody && (
            <Section title="Body">
              <CodeBlock text={request.responseBody} />
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-base-content/50 mb-1.5 text-xs font-medium uppercase tracking-wide">
        {title}
      </div>
      {children}
    </div>
  )
}

function HeaderTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers)
  if (entries.length === 0) return <div className="text-base-content/40 text-sm">—</div>
  return (
    <div className="bg-base-200 overflow-hidden rounded-lg">
      <table className="table table-xs">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td className="text-base-content/60 w-1/3 font-mono">{k}</td>
              <td className="font-mono break-all">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CodeBlock({ text }: { text: string }) {
  return (
    <pre className="bg-base-300 overflow-x-auto rounded-lg p-3 text-xs">
      <code className="font-mono">{text}</code>
    </pre>
  )
}

/**
 * Side-by-side comparison of one request across two runs. The clicked run is on
 * the left, the compared run on the right, with differing lines/fields highlighted.
 */
export function RequestResponseCompare({
  active,
  compare,
}: {
  active: CapturedRequest
  compare: CapturedRequest | null
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <RunSide title="This run" me={active} other={compare} tone="add" />
      {compare ? (
        <RunSide title="Compared run" me={compare} other={active} tone="del" />
      ) : (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <span className="text-base-content/60 text-xs font-semibold uppercase tracking-wide">
              Compared run
            </span>
            <div className="text-base-content/50 text-sm">
              This endpoint was not called in the compared run.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TONE_HL = { add: 'bg-success/20', del: 'bg-error/20' } as const

function RunSide({
  title,
  me,
  other,
  tone,
}: {
  title: string
  me: CapturedRequest
  other: CapturedRequest | null
  tone: 'add' | 'del'
}) {
  const statusChanged = other != null && me.status !== other.status
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base-content/60 text-xs font-semibold uppercase tracking-wide">
            {title}
          </span>
          <MethodBadge method={me.method} outline />
        </div>
        <div className="font-mono text-sm break-all">{me.url}</div>

        <Section title="Request headers">
          <HeaderDiff headers={me.requestHeaders} other={other?.requestHeaders} tone={tone} />
        </Section>
        {me.requestBody && (
          <Section title="Request body">
            <CodeDiff text={me.requestBody} other={other?.requestBody} tone={tone} />
          </Section>
        )}

        <div className="flex items-center gap-2">
          <span className="text-base-content/50 text-xs font-medium uppercase tracking-wide">
            Response
          </span>
          <span className={statusChanged ? `rounded ${TONE_HL[tone]}` : ''}>
            <StatusCodeBadge status={me.status} outline />
          </span>
          <span className="text-base-content/50 text-xs">{me.durationMs}ms</span>
        </div>
        <Section title="Response headers">
          <HeaderDiff headers={me.responseHeaders} other={other?.responseHeaders} tone={tone} />
        </Section>
        {me.responseBody && (
          <Section title="Response body">
            <CodeDiff text={me.responseBody} other={other?.responseBody} tone={tone} />
          </Section>
        )}
      </div>
    </div>
  )
}

function HeaderDiff({
  headers,
  other,
  tone,
}: {
  headers: Record<string, string>
  other?: Record<string, string>
  tone: 'add' | 'del'
}) {
  const entries = Object.entries(headers)
  if (entries.length === 0) return <div className="text-base-content/40 text-sm">—</div>
  return (
    <div className="bg-base-200 overflow-hidden rounded-lg">
      <table className="table table-xs">
        <tbody>
          {entries.map(([k, v]) => {
            const changed = !other || other[k] !== v
            return (
              <tr key={k} className={changed ? TONE_HL[tone] : ''}>
                <td className="text-base-content/60 w-1/3 font-mono">{k}</td>
                <td className="font-mono break-all">{v}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CodeDiff({
  text,
  other,
  tone,
}: {
  text: string
  other?: string
  tone: 'add' | 'del'
}) {
  const lines = text.split('\n')
  const otherLines = new Set((other ?? '').split('\n'))
  return (
    <pre className="bg-base-300 overflow-x-auto rounded-lg p-3 text-xs">
      <code className="font-mono">
        {lines.map((line, i) => {
          const changed = line.trim() !== '' && !otherLines.has(line)
          return (
            <div key={i} className={`whitespace-pre ${changed ? TONE_HL[tone] : ''}`}>
              {line || ' '}
            </div>
          )
        })}
      </code>
    </pre>
  )
}
