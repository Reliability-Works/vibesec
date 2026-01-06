#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { Command } from 'commander'

import { getJavaScriptRules } from '@reliabilityworks/analyzer-javascript'
import {
  detectFrameworks,
  detectFrameworksInWorkspace,
  listWorkspaceProjectRoots,
  scanProject,
  severityFromString,
  toHtml,
  toSarif,
  type FrameworkDetection,
  type FrameworkId,
  type Rule,
  type SeverityName,
  type ScanResult,
} from '@reliabilityworks/core'

type ScanCommandOptions = {
  output: string
  outFile?: string
  failOn: SeverityName
  framework: string
  config?: string
  writeBaseline?: string | boolean
  rulesDir?: string
  color?: boolean
}

type CliOutputOptions = {
  output: string
  outFile?: string
  color?: boolean
}

type CliTheme = {
  critical: (s: string) => string
  high: (s: string) => string
  medium: (s: string) => string
  low: (s: string) => string
  info: (s: string) => string
  ruleId: (s: string) => string
  location: (s: string) => string
  muted: (s: string) => string
  bold: (s: string) => string
}

function createAnsiTheme(enabled: boolean): CliTheme {
  const wrap = (open: string, close: string) => (s: string) => (enabled ? `${open}${s}${close}` : s)

  const reset = '\x1b[0m'
  const bold = wrap('\x1b[1m', reset)
  const dim = wrap('\x1b[2m', reset)

  const red = wrap('\x1b[31m', reset)
  const yellow = wrap('\x1b[33m', reset)
  const blue = wrap('\x1b[34m', reset)
  const magenta = wrap('\x1b[35m', reset)
  const green = wrap('\x1b[32m', reset)
  const cyan = wrap('\x1b[36m', reset)

  return {
    critical: red,
    high: yellow,
    medium: magenta,
    low: blue,
    info: green,
    ruleId: cyan,
    location: dim,
    muted: dim,
    bold,
  }
}

function shouldUseColor(options: CliOutputOptions): boolean {
  if (options.outFile) return false
  if (process.env.NO_COLOR != null) return false
  if (process.env.TERM === 'dumb') return false
  if (!process.stdout.isTTY) return false

  if (typeof options.color === 'boolean') return options.color

  return true
}

function formatCliOutput(
  result: ScanResult,
  options: CliOutputOptions = { output: 'cli' },
): string {
  const theme = createAnsiTheme(shouldUseColor(options))
  const lines: string[] = []

  const divider = theme.muted('────────────────────────────────────────────────────────────')

  if (result.findings.length > 0) {
    lines.push(divider)
    lines.push('')
  }

  for (const finding of result.findings) {
    const severity = finding.severity.toUpperCase()

    const severityColor =
      finding.severity === 'critical'
        ? theme.critical
        : finding.severity === 'high'
          ? theme.high
          : finding.severity === 'medium'
            ? theme.medium
            : theme.low

    const header = `${severityColor('●')} ${severityColor(severity)} ${theme.ruleId(finding.ruleId)}`

    lines.push(header)
    lines.push(`${theme.bold(finding.message)}`)
    lines.push(theme.location(`${finding.location.path}:${finding.location.startLine}`))

    if (finding.excerpt) {
      lines.push('')
      lines.push(`  ${theme.muted(finding.excerpt)}`)
    }

    lines.push('')
  }

  if (result.findings.length > 0) {
    lines.push(divider)
    lines.push('')
  }

  const count = result.findings.length
  const noun = count === 1 ? 'issue' : 'issues'
  lines.push(`Scan complete. ${count} ${noun} found.`)

  return lines.join('\n') + '\n'
}

function shouldShowInfo(options: CliOutputOptions): boolean {
  if (options.output !== 'cli') return false
  if (options.outFile) return false
  return Boolean(process.stderr.isTTY)
}

function logInfo(message: string, options: CliOutputOptions): void {
  if (!shouldShowInfo(options)) return
  const theme = createAnsiTheme(shouldUseColor(options))
  process.stderr.write(`${theme.info('[info]')} ${message}\n`)
}

function parseFrameworkIds(input: string): FrameworkId[] {
  if (!input || input === 'auto') return []

  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s as FrameworkId)
}

function selectFrameworks(detected: FrameworkDetection[], requested: string): FrameworkDetection[] {
  if (requested === 'auto') return detected

  const requestedIds = parseFrameworkIds(requested)
  const byId = new Map(detected.map((d) => [d.id, d] as const))

  const selected: FrameworkDetection[] = []
  for (const id of requestedIds) {
    const hit = byId.get(id)
    if (hit) {
      selected.push(hit)
    } else {
      selected.push({ id, confidence: 'low', evidence: ['user: --framework'] })
    }
  }

  return selected
}

function toPosixPath(p: string): string {
  return p.split(path.sep).join('/')
}

function joinPrefixedGlob(prefix: string, glob: string): string {
  const normalizedPrefix = prefix.replace(/\/+$/, '')
  if (!normalizedPrefix || normalizedPrefix === '.') return glob

  const normalizedGlob = glob.replace(/^\/+/, '')
  return `${normalizedPrefix}/${normalizedGlob}`
}

function scopeRulesToPrefix(rules: Rule[], prefix: string): Rule[] {
  const normalizedPrefix = toPosixPath(prefix)
  if (!normalizedPrefix || normalizedPrefix === '.') return rules

  return rules.map((rule) => {
    if (rule.matcher.type === 'regex') {
      return {
        ...rule,
        matcher: {
          ...rule.matcher,
          fileGlobs: rule.matcher.fileGlobs.map((glob) => joinPrefixedGlob(normalizedPrefix, glob)),
        },
      }
    }

    return {
      ...rule,
      matcher: {
        ...rule.matcher,
        paths: rule.matcher.paths.map((p) => joinPrefixedGlob(normalizedPrefix, p)),
      },
    }
  })
}

async function loadWorkspaceScopedRules(workspaceRoot: string): Promise<Rule[]> {
  const projectRoots = await listWorkspaceProjectRoots(workspaceRoot)
  const rules: Rule[] = []

  for (const projectRoot of projectRoots) {
    const frameworks = await detectFrameworks(projectRoot)
    if (frameworks.length === 0) continue

    const projectRules = await loadRulesForFrameworks(frameworks)
    const projectPrefix = path.relative(workspaceRoot, projectRoot)
    rules.push(...scopeRulesToPrefix(projectRules, projectPrefix))
  }

  return rules
}

async function loadRulesetRules(packageName: string): Promise<Rule[]> {
  const pkgJsonPath = require.resolve(`${packageName}/package.json`)
  const rulesPath = path.join(path.dirname(pkgJsonPath), 'rules.json')
  const raw = await fs.readFile(rulesPath, 'utf8')
  const parsed = JSON.parse(raw) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error(`${packageName} rules.json must be an array`)
  }

  return parsed as Rule[]
}

async function loadRulesForFrameworks(frameworks: FrameworkDetection[]): Promise<Rule[]> {
  const ids = new Set(frameworks.map((f) => String(f.id)))
  const rules: Rule[] = []

  if (ids.has('nextjs')) {
    rules.push(...(await loadRulesetRules('@reliabilityworks/ruleset-nextjs')))
  }

  if (ids.has('react-native')) {
    rules.push(...(await loadRulesetRules('@reliabilityworks/ruleset-react-native')))
  }

  if (ids.has('expo')) {
    rules.push(...(await loadRulesetRules('@reliabilityworks/ruleset-expo')))
  }

  if (ids.has('express')) {
    rules.push(...(await loadRulesetRules('@reliabilityworks/ruleset-express')))
  }

  if (ids.has('sveltekit')) {
    rules.push(...(await loadRulesetRules('@reliabilityworks/ruleset-sveltekit')))
  }

  if (ids.has('astro')) {
    rules.push(...(await loadRulesetRules('@reliabilityworks/ruleset-astro')))
  }

  return rules
}

function readCliVersion(): string {
  const packageJsonPath = path.join(__dirname, '..', 'package.json')

  let raw: string
  try {
    raw = readFileSync(packageJsonPath, 'utf8')
  } catch {
    return '0.0.0'
  }

  const parsed = JSON.parse(raw) as unknown

  if (parsed && typeof parsed === 'object' && 'version' in parsed) {
    const version = (parsed as { version?: unknown }).version
    if (typeof version === 'string' && version.length > 0) return version
  }

  return '0.0.0'
}

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command()

  program
    .name('vibesec')
    .description('Local security scanner for modern frameworks')
    .version(readCliVersion())

  program
    .command('scan')
    .argument('[path]', 'Path to scan', '.')
    .option('-o, --output <format>', 'Output format: cli|json|sarif|html', 'cli')
    .option('--out-file <path>', 'Write output to file')
    .option('--fail-on <severity>', 'Fail on or above: low|medium|high|critical', 'high')
    .option(
      '--framework <name>',
      'Framework: auto|nextjs|react-native|expo|express|sveltekit|astro (comma-separated)',
      'auto',
    )
    .option('--config <path>', 'Config file path (.vibesec.yaml by default)')
    .option(
      '--write-baseline [path]',
      'Write baseline file (defaults to .vibesec.baseline.yaml in scan root)',
    )
    .option('--rules-dir <path>', 'Custom rules dir (.vibesec/rules by default)')
    .option('--no-color', 'Disable ANSI colors')
    .action(async (scanPath: string, options: ScanCommandOptions) => {
      const failOn = severityFromString(options.failOn)

      const absoluteRoot = path.resolve(scanPath)

      logInfo('Detecting frameworks...', options)
      const detected = await detectFrameworksInWorkspace(absoluteRoot)
      const frameworks = selectFrameworks(detected, options.framework)

      logInfo('Loading rulesets...', options)
      const analyzerRules = getJavaScriptRules()
      const additionalRules = [
        ...analyzerRules,
        ...(options.framework === 'auto'
          ? await loadWorkspaceScopedRules(absoluteRoot)
          : await loadRulesForFrameworks(frameworks)),
      ]

      logInfo('Scanning files...', options)
      if (shouldShowInfo(options)) process.stderr.write('\n')

      const writeBaselinePath =
        typeof options.writeBaseline === 'string'
          ? path.isAbsolute(options.writeBaseline)
            ? options.writeBaseline
            : path.join(absoluteRoot, options.writeBaseline)
          : options.writeBaseline
            ? path.join(absoluteRoot, '.vibesec.baseline.yaml')
            : undefined

      const result = await scanProject({
        rootDir: absoluteRoot,
        frameworks,
        additionalRules,
        configPath: options.config,
        customRulesDir: options.rulesDir,
      })

      if (writeBaselinePath) {
        const ignore = result.findings
          .map((finding) => ({ finding: finding.fingerprint, reason: 'baseline' }))
          .sort((a, b) => a.finding.localeCompare(b.finding))

        const lines: string[] = ['# Generated by vibesec', 'ignore:']
        for (const entry of ignore) {
          lines.push(`  - finding: ${entry.finding}`)
          lines.push(`    reason: ${entry.reason}`)
        }

        await fs.mkdir(path.dirname(writeBaselinePath), { recursive: true })
        await fs.writeFile(writeBaselinePath, lines.join('\n') + '\n', 'utf8')

        process.stderr.write(
          `Wrote baseline with ${ignore.length} finding(s) to ${path.relative(process.cwd(), writeBaselinePath)}\n`,
        )

        process.exitCode = 0
        return
      }

      if (options.output === 'json') {
        const json = JSON.stringify(result, null, 2)
        if (options.outFile) {
          await fs.writeFile(options.outFile, json, 'utf8')
        } else {
          process.stdout.write(json + '\n')
        }
      } else if (options.output === 'sarif') {
        const sarif = JSON.stringify(toSarif(result), null, 2)
        if (options.outFile) {
          await fs.writeFile(options.outFile, sarif, 'utf8')
        } else {
          process.stdout.write(sarif + '\n')
        }
      } else if (options.output === 'html') {
        const html = toHtml(result)
        if (options.outFile) {
          await fs.writeFile(options.outFile, html, 'utf8')
        } else {
          process.stdout.write(html + '\n')
        }
      } else {
        process.stdout.write(formatCliOutput(result, options))
      }

      const shouldFail = result.findings.some((finding) => finding.severityRank <= failOn.rank)
      process.exitCode = shouldFail ? 1 : 0
    })

  await program.parseAsync(argv)
}

if (require.main === module) {
  runCli(process.argv).catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
    process.stderr.write(message + '\n')
    process.exitCode = 2
  })
}
