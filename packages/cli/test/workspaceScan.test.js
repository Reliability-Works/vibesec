const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const test = require('node:test')

test('workspace scan scopes framework rules to project roots', async () => {
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
      'json',
      '--framework',
      'auto',
      '--fail-on',
      'critical',
    ],
    { encoding: 'utf8' },
  )

  const result = JSON.parse(output)
  const nextPaths = result.findings
    .filter((finding) => finding.ruleId === 'nextjs/production-browser-sourcemaps')
    .map((finding) => finding.location.path)

  assert.ok(nextPaths.includes('apps/web/next.config.js'))
  assert.equal(nextPaths.includes('apps/api/next.config.js'), false)

  const astroPaths = result.findings
    .filter((finding) => finding.ruleId === 'astro/set-html')
    .map((finding) => finding.location.path)

  assert.ok(astroPaths.includes('apps/astro/src/pages/index.astro'))
  assert.equal(astroPaths.includes('apps/web/decoy.astro'), false)

  const rnManifestPaths = result.findings
    .filter((finding) => finding.ruleId === 'rn/cleartext-traffic')
    .map((finding) => finding.location.path)

  assert.ok(rnManifestPaths.includes('apps/rn/android/app/AndroidManifest.xml'))
  assert.equal(rnManifestPaths.includes('apps/web/android/app/AndroidManifest.xml'), false)

  const expoTokenPaths = result.findings
    .filter((finding) => finding.ruleId === 'rn/asyncstorage-token-key')
    .map((finding) => finding.location.path)

  assert.ok(expoTokenPaths.includes('apps/expo/src.ts'))
  assert.equal(expoTokenPaths.includes('apps/web/src/decoy-rn.ts'), false)
})
