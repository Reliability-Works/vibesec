#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

import { Command } from 'commander'
import {
  detectFrameworks,
  scanProject,
  severityFromString,
  toHtml,
  toSarif,
  type FrameworkDetection,
  type FrameworkId,
  type Rule,
  type SeverityName,
  type ScanResult,
} from '@vibesec/core'

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
    rules.push(...(await loadRulesetRules('@vibesec/ruleset-nextjs')))
  }

  if (ids.has('react-native') || ids.has('expo')) {
    rules.push(...(await loadRulesetRules('@vibesec/ruleset-react-native')))
  }

  return rules
}

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command()

  program
    .name('vibesec')
    .description('Local security scanner for modern frameworks')
    .version('0.0.0')

  program
    .command('scan')
    .argument('[path]', 'Path to scan', '.')
    .option('-o, --output <format>', 'Output format: cli|json|sarif|html', 'cli')
    .option('--out-file <path>', 'Write output to file')
    .option('--fail-on <severity>', 'Fail on or above: low|medium|high|critical', 'high')
    .option('--framework <name>', 'Framework: auto|nextjs|react-native|expo', 'auto')
    .option('--config <path>', 'Config file path (.vibesec.yaml by default)')
    .option('--rules-dir <path>', 'Custom rules dir (.vibesec/rules by default)')
    .action(async (scanPath: string, options: ScanCommandOptions) => {
      const failOn = severityFromString(options.failOn)

      const absoluteRoot = path.resolve(scanPath)
      const detected = await detectFrameworks(absoluteRoot)
      const frameworks = selectFrameworks(detected, options.framework)
      const additionalRules = await loadRulesForFrameworks(frameworks)

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
