import type { Finding, ScanResult, SeverityName } from '../types'

type SarifLevel = 'error' | 'warning' | 'note'

type SarifReport = {
  version: '2.1.0'
  $schema: string
  runs: Array<{
    tool: {
      driver: {
        name: string
        version: string
        informationUri?: string
        rules?: Array<{
          id: string
          name?: string
          shortDescription: { text: string }
          fullDescription?: { text: string }
          help?: { text: string }
          properties?: Record<string, unknown>
        }>
      }
    }
    results: Array<{
      ruleId: string
      level: SarifLevel
      message: { text: string }
      locations: Array<{
        physicalLocation: {
          artifactLocation: { uri: string }
          region: { startLine: number; startColumn: number }
        }
      }>
      partialFingerprints?: Record<string, string>
      properties?: Record<string, unknown>
    }>
  }>
}

function sarifLevel(severity: SeverityName): SarifLevel {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error'
    case 'medium':
      return 'warning'
    case 'low':
      return 'note'
  }
}

function ruleKey(finding: Finding): string {
  return finding.ruleId
}

export function toSarif(result: ScanResult): SarifReport {
  const rulesById = new Map<string, Finding>()
  for (const finding of result.findings) {
    const id = ruleKey(finding)
    if (!rulesById.has(id)) rulesById.set(id, finding)
  }

  const rules = Array.from(rulesById.values()).map((finding) => ({
    id: finding.ruleId,
    name: finding.ruleId,
    shortDescription: { text: finding.ruleTitle },
    fullDescription: finding.ruleDescription ? { text: finding.ruleDescription } : undefined,
    help: { text: finding.message },
    properties: {
      severity: finding.severity,
    },
  }))

  const results = result.findings.map((finding) => ({
    ruleId: finding.ruleId,
    level: sarifLevel(finding.severity),
    message: { text: finding.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: finding.location.path },
          region: {
            startLine: finding.location.startLine,
            startColumn: finding.location.startColumn,
          },
        },
      },
    ],
    partialFingerprints: {
      'vibesec/fingerprint': finding.fingerprint,
    },
    properties: {
      severity: finding.severity,
      fingerprint: finding.fingerprint,
    },
  }))

  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'vibesec',
            version: '0.0.0',
            informationUri: 'https://github.com/Reliability-Works/vibesec',
            rules,
          },
        },
        results,
      },
    ],
  }
}
