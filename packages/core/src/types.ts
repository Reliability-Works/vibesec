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
  ruleTitle: string
  ruleDescription?: string
  severity: SeverityName
  severityRank: number
  message: string
  location: FindingLocation
  fingerprint: string
  excerpt?: string
}

export type FrameworkId = 'nextjs' | 'react-native' | 'expo' | 'express' | 'sveltekit'

export type FrameworkDetection = {
  id: FrameworkId
  confidence: 'high' | 'medium' | 'low'
  evidence: string[]
}

export type ScanResult = {
  rootDir: string
  frameworks: FrameworkDetection[]
  scannedFiles: number
  ignoredFindings: number
  findings: Finding[]
}

export type ScanOptions = {
  rootDir: string
  pathBaseDir?: string
  configRootDir?: string
  configPath?: string
  customRulesDir?: string
  frameworks?: FrameworkDetection[]
  additionalRules?: Rule[]
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
