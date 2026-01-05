import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import fg from 'fast-glob'
import picomatch from 'picomatch'
import { z } from 'zod'
import YAML from 'yaml'

import { BUILTIN_RULES } from './builtinRules'
import { detectFrameworks } from './frameworks'
import type {
  Finding,
  FindingLocation,
  Rule,
  ScanOptions,
  ScanResult,
  Severity,
  SeverityName,
  VibeSecConfig,
} from './types'

const DEFAULT_IGNORES = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/.yarn/**',
  '**/.pnpm/**',
]

const DEFAULT_MAX_FILE_SIZE_BYTES = 1024 * 1024

export type SeverityNameInput = SeverityName

export function severityFromString(name: SeverityNameInput): Severity {
  switch (name) {
    case 'critical':
      return { name, rank: 0 }
    case 'high':
      return { name, rank: 1 }
    case 'medium':
      return { name, rank: 2 }
    case 'low':
      return { name, rank: 3 }
  }
}

function fileExists(p: string): Promise<boolean> {
  return fs
    .stat(p)
    .then(() => true)
    .catch(() => false)
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function isLikelyBinary(buffer: Buffer): boolean {
  for (const b of buffer) {
    if (b === 0) return true
  }
  return false
}

function computeLineInfo(
  text: string,
  matchIndex: number,
): {
  lineNumber: number
  columnNumber: number
  lineText: string
} {
  const upToMatch = text.slice(0, matchIndex)
  const lines = upToMatch.split('\n')
  const lineNumber = lines.length
  const columnNumber = lines[lines.length - 1]?.length ?? 0

  const fullLines = text.split('\n')
  const lineText = fullLines[lineNumber - 1] ?? ''

  return {
    lineNumber,
    columnNumber: columnNumber + 1,
    lineText,
  }
}

function fingerprintForMatch(args: {
  ruleId: string
  relativePath: string
  matchText?: string
  lineText?: string
}): string {
  const material = [
    `rule:${args.ruleId}`,
    `path:${args.relativePath}`,
    args.matchText ? `match:${args.matchText}` : undefined,
    args.lineText ? `line:${args.lineText.trim()}` : undefined,
  ]
    .filter(Boolean)
    .join('\n')

  return sha256Hex(material)
}

const ignoreEntrySchema = z.union([
  z.object({
    rule: z.string().min(1),
    reason: z.string().min(1),
    paths: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    finding: z.string().min(1),
    reason: z.string().min(1),
  }),
])

const configSchema = z.object({
  ignore: z.array(ignoreEntrySchema).optional(),
})

function resolveConfigPath(rootDir: string, candidate: string): string {
  if (!candidate) return candidate
  return path.isAbsolute(candidate) ? candidate : path.join(rootDir, candidate)
}

async function loadConfigFromCandidates(candidates: string[]): Promise<VibeSecConfig> {
  for (const candidate of candidates) {
    if (!(await fileExists(candidate))) continue
    const raw = await fs.readFile(candidate, 'utf8')
    const parsed = YAML.parse(raw)
    const validated = configSchema.safeParse(parsed)
    if (!validated.success) {
      throw new Error(`Invalid config at ${candidate}`)
    }
    return validated.data
  }

  return {}
}

function loadConfig(configRootDir: string, configPath?: string): Promise<VibeSecConfig> {
  const candidates = configPath
    ? [resolveConfigPath(configRootDir, configPath)]
    : [path.join(configRootDir, '.vibesec.yaml'), path.join(configRootDir, '.vibesec.yml')]

  return loadConfigFromCandidates(candidates)
}

function loadBaseline(configRootDir: string, baselinePath?: string): Promise<VibeSecConfig> {
  const candidates = baselinePath
    ? [resolveConfigPath(configRootDir, baselinePath)]
    : [
        path.join(configRootDir, '.vibesec.baseline.yaml'),
        path.join(configRootDir, '.vibesec.baseline.yml'),
      ]

  return loadConfigFromCandidates(candidates)
}

const ruleSchema: z.ZodType<Rule> = z.object({
  id: z.string().min(1),
  severity: z.union([
    z.literal('critical'),
    z.literal('high'),
    z.literal('medium'),
    z.literal('low'),
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  matcher: z.union([
    z.object({
      type: z.literal('file_presence'),
      paths: z.array(z.string().min(1)).min(1),
      message: z.string().min(1),
    }),
    z.object({
      type: z.literal('regex'),
      fileGlobs: z.array(z.string().min(1)).min(1),
      pattern: z.string().min(1),
      flags: z.string().optional(),
      message: z.string().min(1),
    }),
  ]),
})

async function loadCustomRules(configRootDir: string, customRulesDir?: string): Promise<Rule[]> {
  const rulesDir = customRulesDir ?? path.join(configRootDir, '.vibesec', 'rules')
  if (!(await fileExists(rulesDir))) return []

  const entries = await fs.readdir(rulesDir, { withFileTypes: true })
  const ruleFiles = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml') || name.endsWith('.json'))

  const rules: Rule[] = []

  for (const fileName of ruleFiles) {
    const fullPath = path.join(rulesDir, fileName)
    const raw = await fs.readFile(fullPath, 'utf8')

    const parsed = fileName.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw)
    const items = Array.isArray(parsed) ? parsed : [parsed]

    for (const item of items) {
      const validated = ruleSchema.safeParse(item)
      if (!validated.success) {
        throw new Error(`Invalid custom rule in ${fullPath}`)
      }
      rules.push(validated.data)
    }
  }

  return rules
}

function isIgnored(config: VibeSecConfig, finding: Finding): boolean {
  const ignores = config.ignore ?? []

  for (const entry of ignores) {
    if ('finding' in entry) {
      if (entry.finding === finding.fingerprint) return true
      continue
    }

    if (entry.rule !== finding.ruleId) continue

    if (!entry.paths || entry.paths.length === 0) return true
    const matchesPath = picomatch(entry.paths, { dot: true })
    if (matchesPath(finding.location.path)) return true
  }

  return false
}

async function listProjectFiles(rootDir: string): Promise<string[]> {
  return fg('**/*', {
    cwd: rootDir,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: DEFAULT_IGNORES,
  })
}

async function readTextFileIfSafe(fullPath: string, maxBytes: number): Promise<string | null> {
  const stat = await fs.stat(fullPath)
  if (stat.size > maxBytes) return null

  const handle = await fs.open(fullPath, 'r')
  try {
    const probeSize = Math.min(stat.size, 4096)
    const probe = Buffer.alloc(probeSize)
    await handle.read(probe, 0, probeSize, 0)
    if (isLikelyBinary(probe)) return null

    return await handle.readFile({ encoding: 'utf8' })
  } finally {
    await handle.close()
  }
}

function makeFinding(args: {
  rule: Rule
  location: FindingLocation
  message: string
  excerpt?: string
  matchText?: string
  lineText?: string
}): Finding {
  const severity = severityFromString(args.rule.severity)
  const fingerprint = fingerprintForMatch({
    ruleId: args.rule.id,
    relativePath: args.location.path,
    matchText: args.matchText,
    lineText: args.lineText,
  })

  return {
    ruleId: args.rule.id,
    ruleTitle: args.rule.title,
    ruleDescription: args.rule.description,
    severity: args.rule.severity,
    severityRank: severity.rank,
    message: args.message,
    location: args.location,
    fingerprint,
    excerpt: args.excerpt,
  }
}

export async function scanProject(options: ScanOptions): Promise<ScanResult> {
  const scanDir = path.resolve(options.rootDir)
  const configRootDir = path.resolve(options.configRootDir ?? scanDir)
  const pathBaseDir = path.resolve(options.pathBaseDir ?? scanDir)
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES

  const config = await loadConfig(configRootDir, options.configPath)
  const baseline = await loadBaseline(configRootDir, options.baselinePath)
  const mergedConfig: VibeSecConfig = {
    ignore: [...(config.ignore ?? []), ...(baseline.ignore ?? [])],
  }

  const additionalRules = options.additionalRules ?? []
  const rules = [
    ...BUILTIN_RULES,
    ...(await loadCustomRules(configRootDir, options.customRulesDir)),
    ...additionalRules,
  ]

  const frameworks = options.frameworks ?? (await detectFrameworks(scanDir))
  const files = await listProjectFiles(scanDir)

  const toBasePath = (scanRelativePath: string): string => {
    const absolutePath = path.join(scanDir, scanRelativePath)
    const rel = path.relative(pathBaseDir, absolutePath)
    return (rel || scanRelativePath).split(path.sep).join('/')
  }

  const findings: Finding[] = []
  let ignoredFindings = 0

  for (const rule of rules) {
    if (rule.matcher.type === 'file_presence') {
      const matches = files.filter(picomatch(rule.matcher.paths, { dot: true }))
      for (const relativePath of matches) {
        const finding = makeFinding({
          rule,
          location: { path: toBasePath(relativePath), startLine: 1, startColumn: 1 },
          message: rule.matcher.message,
        })

        if (isIgnored(mergedConfig, finding)) {
          ignoredFindings += 1
          continue
        }

        findings.push(finding)
      }
      continue
    }

    const compiled = new RegExp(rule.matcher.pattern, rule.matcher.flags)
    const matchesFile = picomatch(rule.matcher.fileGlobs, { dot: true })

    for (const relativePath of files) {
      if (!matchesFile(relativePath)) continue

      const fullPath = path.join(scanDir, relativePath)
      let text: string | null
      try {
        text = await readTextFileIfSafe(fullPath, maxFileSizeBytes)
      } catch {
        continue
      }
      if (!text) continue

      const match = compiled.exec(text)
      if (!match || match.index == null) continue

      const { lineNumber, columnNumber, lineText } = computeLineInfo(text, match.index)
      const excerpt = lineText.trim().slice(0, 300)

      const finding = makeFinding({
        rule,
        location: {
          path: toBasePath(relativePath),
          startLine: lineNumber,
          startColumn: columnNumber,
        },
        message: rule.matcher.message,
        excerpt,
        matchText: match[0],
        lineText,
      })

      if (isIgnored(mergedConfig, finding)) {
        ignoredFindings += 1
        continue
      }

      findings.push(finding)
    }
  }

  findings.sort((a, b) => a.severityRank - b.severityRank)

  return {
    rootDir: scanDir,
    frameworks,
    scannedFiles: files.length,
    ignoredFindings,
    findings,
  }
}
