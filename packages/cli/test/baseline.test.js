const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf8')
}

test('scan --write-baseline suppresses findings on next run', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vibesec-baseline-'))

  try {
    const cliPath = path.join(__dirname, '..', 'dist', 'cli.js')

    await writeFile(
      path.join(tempRoot, 'next.config.js'),
      'module.exports = {\n  productionBrowserSourceMaps: true,\n}\n',
    )

    await writeFile(
      path.join(tempRoot, 'src', 'next-rules.ts'),
      'export const cfg = { revalidate: 0 }\nexport const v = process.env.NEXT_PUBLIC_API_SECRET\n',
    )

    execFileSync(
      process.execPath,
      [
        '--enable-source-maps',
        cliPath,
        'scan',
        tempRoot,
        '--framework',
        'nextjs',
        '--fail-on',
        'critical',
        '--write-baseline',
      ],
      { encoding: 'utf8' },
    )

    const baselinePath = path.join(tempRoot, '.vibesec.baseline.yaml')
    const baselineRaw = await fs.readFile(baselinePath, 'utf8')
    assert.ok(baselineRaw.includes('ignore:'))
    assert.ok(baselineRaw.includes('finding:'))

    const output = execFileSync(
      process.execPath,
      [
        '--enable-source-maps',
        cliPath,
        'scan',
        tempRoot,
        '--framework',
        'nextjs',
        '--output',
        'json',
        '--fail-on',
        'critical',
      ],
      { encoding: 'utf8' },
    )

    const result = JSON.parse(output)
    assert.equal(result.findings.length, 0)
    assert.ok(result.ignoredFindings > 0)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})
