export type SeverityName = 'critical' | 'high' | 'medium' | 'low'

export type Severity = {
  name: SeverityName
  rank: number
}

export type FindingLocation = {
  path: string
  startLine: number
  startColumn: number
}

export type Finding = {
  ruleId: string
  severity: SeverityName
  severityRank: number
  message: string
  location: FindingLocation
  fingerprint: string
  excerpt?: string
}

export type ScanResult = {
  rootDir: string
  scannedFiles: number
  ignoredFindings: number
  findings: Finding[]
}

export type ScanOptions = {
  rootDir: string
  configPath?: string
  customRulesDir?: string
  maxFileSizeBytes?: number
}

export type IgnoreByRule = {
  rule: string
  reason: string
  paths?: string[]
}

export type IgnoreByFinding = {
  finding: string
  reason: string
}

export type VibeSecConfig = {
  ignore?: Array<IgnoreByRule | IgnoreByFinding>
}

export type FilePresenceMatcher = {
  type: 'file_presence'
  paths: string[]
  message: string
}

export type RegexMatcher = {
  type: 'regex'
  fileGlobs: string[]
  pattern: string
  flags?: string
  message: string
}

export type RuleMatcher = FilePresenceMatcher | RegexMatcher

export type Rule = {
  id: string
  severity: SeverityName
  title: string
  description?: string
  matcher: RuleMatcher
}
