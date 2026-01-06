const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const test = require('node:test')

test('html output includes summary chart and findings table', async () => {
  const fixtureRoot = path.join(__dirname, '..', '..', 'core', 'test', 'fixtures', 'monorepo')
  const cliPath = path.join(__dirname, '..', 'dist', 'cli.js')

  const output = execFileSync(
    process.execPath,
    [
      '--enable-source-maps',
      cliPath,
      'scan',
      fixtureRoot,
      '--output',
      'html',
      '--framework',
      'auto',
      '--fail-on',
      'critical',
    ],
    { encoding: 'utf8' },
  )

  assert.match(output, /<title>VibeSec Security Report<\/title>/)
  assert.match(output, /Frameworks:/)
  assert.match(output, /<svg[^>]*class="chart-svg"/)
  assert.match(output, /<table>/)
  assert.match(output, /id="findings-body"/)
})
