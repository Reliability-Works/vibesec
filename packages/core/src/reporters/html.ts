import type { ScanResult } from '../types'

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function toHtml(result: ScanResult): string {
  const frameworks = result.frameworks.map((f) => escapeHtml(f.id)).join(', ')
  const findings = result.findings
    .map((f) => {
      const location = `${escapeHtml(f.location.path)}:${f.location.startLine}`
      const title = escapeHtml(f.ruleTitle)
      const message = escapeHtml(f.message)
      const severity = escapeHtml(f.severity.toUpperCase())

      return `
        <div class="finding">
          <div class="finding__header">
            <span class="badge badge--${f.severity}">${severity}</span>
            <span class="finding__rule">${escapeHtml(f.ruleId)}</span>
          </div>
          <div class="finding__title">${title}</div>
          <div class="finding__location">${location}</div>
          <div class="finding__message">${message}</div>
        </div>
      `
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>VibeSec report</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; color: #e5e7eb; background: #0b1220; }
      h1 { margin: 0 0 8px 0; }
      .meta { color: #9ca3af; margin-bottom: 16px; }
      .finding { border: 1px solid #1f2937; border-radius: 10px; padding: 12px; margin: 12px 0; background: #0f172a; }
      .finding__header { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
      .finding__rule { color: #cbd5e1; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono"; font-size: 12px; }
      .finding__title { font-weight: 600; margin-bottom: 6px; }
      .finding__location { color: #9ca3af; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono"; font-size: 12px; margin-bottom: 6px; }
      .finding__message { color: #e5e7eb; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; }
      .badge--critical { background: #7f1d1d; color: #fecaca; }
      .badge--high { background: #9a3412; color: #ffedd5; }
      .badge--medium { background: #92400e; color: #fef3c7; }
      .badge--low { background: #1f2937; color: #e5e7eb; }
    </style>
  </head>
  <body>
    <h1>VibeSec report</h1>
    <div class="meta">Frameworks: ${frameworks || 'none'} · Findings: ${result.findings.length}</div>
    ${findings || '<div class="meta">No findings.</div>'}
  </body>
</html>
`
}
