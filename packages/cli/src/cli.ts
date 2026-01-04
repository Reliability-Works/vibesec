#!/usr/bin/env node

import fs from 'node:fs/promises'

import { Command } from 'commander'
import { scanProject, severityFromString, type SeverityName, type ScanResult } from '@vibesec/core'

type ScanCommandOptions = {
  output: string
  outFile?: string
  failOn: SeverityName
  config?: string
  rulesDir?: string
}

function formatCliOutput(result: ScanResult): string {
  const lines: string[] = []

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

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command()

  program
    .name('vibesec')
    .description('Local security scanner for modern frameworks')
    .version('0.0.0')

  program
    .command('scan')
    .argument('[path]', 'Path to scan', '.')
    .option('-o, --output <format>', 'Output format: cli|json', 'cli')
    .option('--out-file <path>', 'Write output to file')
    .option('--fail-on <severity>', 'Fail on or above: low|medium|high|critical', 'high')
    .option('--config <path>', 'Config file path (.vibesec.yaml by default)')
    .option('--rules-dir <path>', 'Custom rules dir (.vibesec/rules by default)')
    .action(async (scanPath: string, options: ScanCommandOptions) => {
      const failOn = severityFromString(options.failOn)
      const result = await scanProject({
        rootDir: scanPath,
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
