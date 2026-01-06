const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const test = require('node:test')

test('cli output is pretty and respects --no-color', async () => {
  const fixtureRoot = path.join(
    __dirname,
    '..',
    '..',
    'core',
    'test',
    'fixtures',
    'monorepo',
    'apps',
    'web',
  )
  const cliPath = path.join(__dirname, '..', 'dist', 'cli.js')

  const output = execFileSync(
    process.execPath,
    [
      '--enable-source-maps',
      cliPath,
      'scan',
      fixtureRoot,
      '--framework',
      'nextjs',
      '--output',
      'cli',
      '--no-color',
      '--fail-on',
      'critical',
    ],
    { encoding: 'utf8' },
  )

  assert.equal(output.includes('\x1b['), false)
  assert.ok(output.includes('Scan complete.'))
  assert.ok(output.includes('next.config.js:'))
})
