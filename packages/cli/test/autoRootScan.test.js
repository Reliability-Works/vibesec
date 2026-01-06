const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const test = require('node:test')

function runScan(fixtureRoot) {
  const cliPath = path.join(__dirname, '..', 'dist', 'cli.js')

  const output = execFileSync(
    process.execPath,
    [
      '--enable-source-maps',
      cliPath,
      'scan',
      fixtureRoot,
      '--output',
      'json',
      '--framework',
      'auto',
      '--fail-on',
      'critical',
    ],
    { encoding: 'utf8' },
  )

  return JSON.parse(output)
}

test('auto detects frameworks in scan root (expo)', async () => {
  const fixtureRoot = path.join(__dirname, '..', '..', 'core', 'test', 'fixtures', 'single-expo')
  const result = runScan(fixtureRoot)

  const frameworkIds = (result.frameworks ?? []).map((f) => f.id)
  assert.ok(frameworkIds.includes('expo'))

  const expoTokenFindings = (result.findings ?? []).filter(
    (finding) => finding.ruleId === 'expo/asyncstorage-token-key',
  )

  assert.ok(expoTokenFindings.some((finding) => finding.location.path === 'src.js'))
})

test('auto detects frameworks in scan root (react-native)', async () => {
  const fixtureRoot = path.join(__dirname, '..', '..', 'core', 'test', 'fixtures', 'single-rn')
  const result = runScan(fixtureRoot)

  const frameworkIds = (result.frameworks ?? []).map((f) => f.id)
  assert.ok(frameworkIds.includes('react-native'))

  const rnTokenFindings = (result.findings ?? []).filter(
    (finding) => finding.ruleId === 'rn/asyncstorage-token-key',
  )

  assert.ok(rnTokenFindings.some((finding) => finding.location.path === 'src.js'))
})
