#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { Command } from 'commander'
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
} from '@reliability-works/core'

type ScanCommandOptions = {
  output: string
  outFile?: string
  failOn: SeverityName
  framework: string
  config?: string
  rulesDir?: string
}

function formatCliOutput(result: ScanResult): string {
  const lines: string[] = []

  if (result.frameworks.length > 0) {
    const frameworkList = result.frameworks.map((f) => f.id).join(', ')
    lines.push(`Frameworks: ${frameworkList}`)
    lines.push('')
  }

  for (const finding of result.findings) {
    lines.push(
      `${finding.severity.toUpperCase()} ${finding.ruleId} ${finding.location.path}:${finding.location.startLine}`,
    )
    lines.push(`  ${finding.message}`)
    lines.push('')
  }

  lines.push(`Scan complete: ${result.findings.length} issue(s) found`)

  return lines.join('\n') + '\n'
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
  const ids = new Set(frameworks.map((f) => f.id))
  const rules: Rule[] = []

  if (ids.has('nextjs')) {
    rules.push(...(await loadRulesetRules('@reliability-works/ruleset-nextjs')))
  }

  if (ids.has('react-native') || ids.has('expo')) {
    rules.push(...(await loadRulesetRules('@reliability-works/ruleset-react-native')))
  }

  if (ids.has('express')) {
    rules.push(...(await loadRulesetRules('@reliability-works/ruleset-express')))
  }

  if (ids.has('sveltekit')) {
    rules.push(...(await loadRulesetRules('@reliability-works/ruleset-sveltekit')))
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
      'Framework: auto|nextjs|react-native|expo|express|sveltekit (comma-separated)',
      'auto',
    )
    .option('--config <path>', 'Config file path (.vibesec.yaml by default)')
    .option('--rules-dir <path>', 'Custom rules dir (.vibesec/rules by default)')
    .action(async (scanPath: string, options: ScanCommandOptions) => {
      const failOn = severityFromString(options.failOn)

      const absoluteRoot = path.resolve(scanPath)
      const detected = await detectFrameworksInWorkspace(absoluteRoot)
      const frameworks = selectFrameworks(detected, options.framework)
      const additionalRules =
        options.framework === 'auto'
          ? await loadWorkspaceScopedRules(absoluteRoot)
          : await loadRulesForFrameworks(frameworks)

      const result = await scanProject({
        rootDir: absoluteRoot,
        frameworks,
        additionalRules,
        configPath: options.config,
        customRulesDir: options.rulesDir,
      })

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
        process.stdout.write(formatCliOutput(result))
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
