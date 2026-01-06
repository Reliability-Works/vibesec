import type { ScanResult, SeverityName } from '../types'

function escapeHtml(input: string): string {
  return (input || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const SEVERITY_COLORS: Record<SeverityName | 'info', string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#94a3b8',
}

const SEVERITY_RANK: Record<SeverityName, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function generateChart(stats: Record<string, number>, total: number): string {
  if (total === 0) {
    return `
      <svg viewBox="0 0 32 32" class="chart-svg">
        <circle r="16" cx="16" cy="16" fill="none" stroke="#334155" stroke-width="4" />
        <text x="50%" y="50%" dy=".3em" text-anchor="middle" class="chart-text">0</text>
      </svg>
    `
  }

  let offset = 0
  const sortedStats = Object.entries(stats).sort(
    ([a], [b]) =>
      (SEVERITY_RANK[a as SeverityName] ?? 99) - (SEVERITY_RANK[b as SeverityName] ?? 99),
  )

  const segments = sortedStats
    .map(([severity, count]) => {
      if (count === 0) return ''
      const percentage = (count / total) * 100
      const color = SEVERITY_COLORS[severity as SeverityName] || SEVERITY_COLORS.info

      const segment = `
        <circle r="15.9155" cx="16" cy="16" fill="none" stroke="${color}" stroke-width="4"
          stroke-dasharray="${percentage} 100" stroke-dashoffset="${offset * -1}" />
      `
      offset += percentage
      return segment
    })
    .join('\n')

  return `
    <svg viewBox="0 0 32 32" class="chart-svg">
      ${segments}
      <text x="50%" y="50%" dy=".3em" text-anchor="middle" class="chart-text">${total}</text>
    </svg>
  `
}

export function toHtml(result: ScanResult): string {
  const findings = result.findings
  const total = findings.length
  const stats: Record<SeverityName, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  findings.forEach((f) => {
    if (stats[f.severity] !== undefined) {
      stats[f.severity]++
    }
  })

  const chartSvg = generateChart(stats, total)

  const frameworkList = result.frameworks.map((f) => escapeHtml(f.id)).join(', ') || 'none'
  const generatedAt = new Date()

  const statsCards = Object.entries(stats)
    .sort(([a], [b]) => SEVERITY_RANK[a as SeverityName] - SEVERITY_RANK[b as SeverityName])
    .map(
      ([severity, count]) => `
      <div class="stat-card border-${severity}">
        <div class="stat-label">${escapeHtml(severity)}</div>
        <div class="stat-value text-${severity}">${count}</div>
      </div>
    `,
    )
    .join('')

  const tableRows = findings
    .map((f) => {
      const location = `${escapeHtml(f.location.path)}:${f.location.startLine}`
      const severityClass = `badge--${f.severity}`
      const excerpt = f.excerpt
        ? `<pre class="excerpt"><code>${escapeHtml(f.excerpt)}</code></pre>`
        : ''
      const description = f.ruleDescription
        ? `<div class="desc">${escapeHtml(f.ruleDescription)}</div>`
        : ''

      const sortRule = escapeHtml(f.ruleId).toLowerCase()
      const sortTitle = escapeHtml(f.ruleTitle).toLowerCase()
      const sortMessage = escapeHtml(f.message).toLowerCase()
      const sortLocation = `${escapeHtml(f.location.path)}:${f.location.startLine}`.toLowerCase()

      return `
        <tr class="finding-row" data-severity="${f.severity}" data-severity-rank="${SEVERITY_RANK[f.severity]}" data-sort-rule="${sortRule}" data-sort-title="${sortTitle}" data-sort-message="${sortMessage}" data-sort-location="${sortLocation}">
          <td class="col-severity"><span class="badge ${severityClass}">${f.severity}</span></td>
          <td class="col-rule">
            <div class="rule-id">${escapeHtml(f.ruleId)}</div>
            <div class="rule-title">${escapeHtml(f.ruleTitle)}</div>
          </td>
          <td class="col-msg">
            <div>${escapeHtml(f.message)}</div>
            <details>
              <summary>View details</summary>
              <div class="details-content">
                ${description}
                ${excerpt}
              </div>
            </details>
          </td>
          <td class="col-loc">${location}</td>
        </tr>
      `
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VibeSec Security Report</title>
  <style>
    :root {
      --bg-app: #0f172a;
      --bg-panel: #1e293b;
      --bg-hover: #334155;
      --border: #334155;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      
      /* Severities */
      --sev-critical: #ef4444;
      --sev-high: #f97316;
      --sev-medium: #eab308;
      --sev-low: #3b82f6;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg-app);
      color: var(--text-main);
      line-height: 1.5;
    }

    /* Layout */
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header { margin-bottom: 3rem; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; }
    h1 { margin: 0; font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
    .meta { color: var(--text-muted); font-size: 0.875rem; margin-top: 0.5rem; }

    /* Dashboard Grid */
    .dashboard {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 2rem;
      margin-bottom: 3rem;
    }
    @media (max-width: 768px) { .dashboard { grid-template-columns: 1fr; } }

    /* Chart */
    .chart-box {
      background: var(--bg-panel);
      border-radius: 12px;
      padding: 1.5rem;
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .chart-svg { width: 160px; height: 160px; transform: rotate(-90deg); }
    .chart-text { fill: var(--text-main); font-size: 0.5rem; font-weight: 700; transform: rotate(90deg); transform-origin: center; }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 1rem;
      align-content: start;
    }
    .stat-card {
      background: var(--bg-panel);
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      border-left-width: 4px;
    }
    .stat-label { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .stat-value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }

    /* Colors */
    .text-critical { color: var(--sev-critical); }
    .border-critical { border-left-color: var(--sev-critical); }
    .text-high { color: var(--sev-high); }
    .border-high { border-left-color: var(--sev-high); }
    .text-medium { color: var(--sev-medium); }
    .border-medium { border-left-color: var(--sev-medium); }
    .text-low { color: var(--sev-low); }
    .border-low { border-left-color: var(--sev-low); }

    /* Controls */
    .controls {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
    }
    .search-box {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      width: 300px;
      font-size: 0.875rem;
    }
    .search-box:focus { outline: 2px solid var(--primary); border-color: transparent; }

    /* Table */
    .table-container {
      background: var(--bg-panel);
      border-radius: 12px;
      border: 1px solid var(--border);
      overflow-x: auto;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    table { width: 100%; border-collapse: collapse; min-width: 800px; }
    th {
      background: var(--bg-panel);
      padding: 1rem;
      text-align: left;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
    }
    .th-btn {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .th-btn::after {
      content: '↕';
      color: var(--text-muted);
      font-size: 0.75rem;
      opacity: 0.6;
    }
    .th-btn[data-dir="asc"]::after { content: '↑'; opacity: 0.9; }
    .th-btn[data-dir="desc"]::after { content: '↓'; opacity: 0.9; }
    .th-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 4px; }
    td {
      padding: 1rem;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--bg-hover); }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge--critical { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge--high { background: rgba(249, 115, 22, 0.15); color: #fdba74; border: 1px solid rgba(249, 115, 22, 0.3); }
    .badge--medium { background: rgba(234, 179, 8, 0.15); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.3); }
    .badge--low { background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3); }

    /* Typography in Table */
    .rule-id { font-family: ui-monospace, monospace; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; }
    .rule-title { font-weight: 600; color: var(--text-main); }
    .col-loc { font-family: ui-monospace, monospace; font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; }
    .col-severity { width: 100px; }
    
    /* Details */
    details { margin-top: 0.5rem; font-size: 0.875rem; }
    summary { cursor: pointer; color: var(--primary); font-size: 0.75rem; user-select: none; }
    summary:hover { text-decoration: underline; }
    .details-content { margin-top: 0.5rem; padding: 0.75rem; background: #0f172a; border-radius: 6px; border: 1px solid var(--border); }
    .excerpt { margin: 0.5rem 0 0; overflow-x: auto; color: #e2e8f0; font-size: 0.75rem; }
    .desc { margin-bottom: 0.5rem; color: var(--text-muted); }
    
    /* Empty State */
    .empty-state { padding: 4rem; text-align: center; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        VibeSec Report
      </h1>
      <div class="meta">
        Frameworks: ${frameworkList} · Findings: ${total} · Files: ${result.scannedFiles} · Ignored: ${result.ignoredFindings}
        <span class="meta-sep">·</span>
        Generated: ${escapeHtml(generatedAt.toLocaleString())}
      </div>
    </header>

    <div class="dashboard">
      <div class="chart-box">
        ${chartSvg}
      </div>
      <div class="stats-grid">
        <div class="stat-card" style="border-left-color: var(--text-main)">
          <div class="stat-label">Total Findings</div>
          <div class="stat-value">${total}</div>
        </div>
        ${statsCards}
      </div>
    </div>

    <div class="controls">
      <input type="text" id="search" class="search-box" placeholder="Search rules, files, or messages..." />
      <div class="filters">
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th><button type="button" class="th-btn" data-sort="severity">Severity</button></th>
            <th><button type="button" class="th-btn" data-sort="rule">Rule</button></th>
            <th><button type="button" class="th-btn" data-sort="message">Message</button></th>
            <th><button type="button" class="th-btn" data-sort="location">Location</button></th>
          </tr>
        </thead>
        <tbody id="findings-body">
          ${tableRows || '<tr><td colspan="4" class="empty-state">No security findings detected. Nice work!</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const searchInput = document.getElementById('search')
    const tableBody = document.getElementById('findings-body')
    const allRows = Array.from(tableBody.getElementsByTagName('tr'))
    const sortButtons = Array.from(document.querySelectorAll('.th-btn'))

    function debounce(fn, delay) {
      let timeout
      return (...args) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => fn.apply(this, args), delay)
      }
    }

    function filterRows() {
      const term = (searchInput.value || '').toLowerCase()

      allRows.forEach((row) => {
        if (row.cells.length === 1) return

        const severity = row.querySelector('.badge')?.textContent?.toLowerCase() ?? ''
        const ruleId = row.querySelector('.rule-id')?.textContent?.toLowerCase() ?? ''
        const ruleTitle = row.querySelector('.rule-title')?.textContent?.toLowerCase() ?? ''
        const message = row.querySelector('.col-msg > div')?.textContent?.toLowerCase() ?? ''
        const location = row.querySelector('.col-loc')?.textContent?.toLowerCase() ?? ''

        const text =
          severity + ' ' + ruleId + ' ' + ruleTitle + ' ' + message + ' ' + location
        row.style.display = text.includes(term) ? '' : 'none'
      })
    }

    function getSortValue(row, key) {
      if (key === 'severity') return Number(row.dataset.severityRank ?? 99)
      if (key === 'rule') return row.dataset.sortRule ?? ''
      if (key === 'message') return row.dataset.sortMessage ?? ''
      if (key === 'location') return row.dataset.sortLocation ?? ''
      return ''
    }

    function setActiveSort(button, dir) {
      sortButtons.forEach((b) => {
        if (b === button) {
          b.dataset.dir = dir
        } else {
          delete b.dataset.dir
        }
      })
    }

    function sortRows(key, dir) {
      const rows = Array.from(tableBody.querySelectorAll('tr.finding-row'))

      rows.sort((a, b) => {
        const av = getSortValue(a, key)
        const bv = getSortValue(b, key)

        if (typeof av === 'number' && typeof bv === 'number') {
          return (av - bv) * dir
        }

        return String(av).localeCompare(String(bv)) * dir
      })

      rows.forEach((row) => tableBody.appendChild(row))
    }

    sortButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sort
        if (!key) return

        const currentDir = btn.dataset.dir
        const nextDir = currentDir === 'asc' ? 'desc' : 'asc'
        const dir = nextDir === 'asc' ? 1 : -1

        setActiveSort(btn, nextDir)
        sortRows(key, dir)
        filterRows()
      })
    })

    searchInput.addEventListener('input', debounce(filterRows, 150))

    const defaultBtn = sortButtons.find((b) => b.dataset.sort === 'severity')
    if (defaultBtn) {
      setActiveSort(defaultBtn, 'asc')
      sortRows('severity', 1)
    }
  </script>

</body>
</html>
`
}
