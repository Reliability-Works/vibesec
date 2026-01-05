const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const test = require('node:test')

function rulePaths(result, ruleId) {
  return result.findings
    .filter((finding) => finding.ruleId === ruleId)
    .map((finding) => finding.location.path)
}

function assertAllPrefixed(paths, allowedPrefixes, ruleId) {
  const prefixes = Array.isArray(allowedPrefixes) ? allowedPrefixes : [allowedPrefixes]
  for (const p of paths) {
    assert.ok(
      prefixes.some((prefix) => p.startsWith(prefix)),
      `${ruleId} should be scoped to ${prefixes.join(' or ')}, got ${p}`,
    )
  }
}

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

  const nextSourcemaps = rulePaths(result, 'nextjs/production-browser-sourcemaps')
  assert.ok(nextSourcemaps.includes('apps/web/next.config.js'))
  assert.equal(nextSourcemaps.includes('apps/api/next.config.js'), false)
  assertAllPrefixed(nextSourcemaps, 'apps/web/', 'nextjs/production-browser-sourcemaps')

  const nextPublicSecret = rulePaths(result, 'nextjs/next-public-secret-name')
  assert.ok(nextPublicSecret.includes('apps/web/src/next-rules.ts'))
  assertAllPrefixed(nextPublicSecret, 'apps/web/', 'nextjs/next-public-secret-name')

  const nextRevalidateZero = rulePaths(result, 'nextjs/unsafe-revalidate-zero')
  assert.ok(nextRevalidateZero.includes('apps/web/src/next-rules.ts'))
  assertAllPrefixed(nextRevalidateZero, 'apps/web/', 'nextjs/unsafe-revalidate-zero')

  const corsWildcard = rulePaths(result, 'express/cors-wildcard-origin')
  assert.ok(corsWildcard.includes('apps/api/express-rules.ts'))
  assertAllPrefixed(corsWildcard, 'apps/api/', 'express/cors-wildcard-origin')

  const allowOriginStar = rulePaths(result, 'express/allow-origin-star-header')
  assert.ok(allowOriginStar.includes('apps/api/express-rules.ts'))
  assertAllPrefixed(allowOriginStar, 'apps/api/', 'express/allow-origin-star-header')

  const sessionCookieSecureFalse = rulePaths(result, 'express/session-cookie-secure-false')
  assert.ok(sessionCookieSecureFalse.includes('apps/api/express-rules.ts'))
  assertAllPrefixed(sessionCookieSecureFalse, 'apps/api/', 'express/session-cookie-secure-false')

  const csrfCheckOrigin = rulePaths(result, 'sveltekit/csrf-checkorigin-false')
  assert.ok(csrfCheckOrigin.includes('apps/kit/svelte.config.js'))
  assertAllPrefixed(csrfCheckOrigin, 'apps/kit/', 'sveltekit/csrf-checkorigin-false')

  const viteHostAll = rulePaths(result, 'sveltekit/vite-server-host-all')
  assert.ok(viteHostAll.includes('apps/kit/vite.config.js'))
  assertAllPrefixed(viteHostAll, 'apps/kit/', 'sveltekit/vite-server-host-all')

  const astroSetHtml = rulePaths(result, 'astro/set-html')
  assert.ok(astroSetHtml.includes('apps/astro/src/pages/index.astro'))
  assert.equal(astroSetHtml.includes('apps/web/decoy.astro'), false)
  assertAllPrefixed(astroSetHtml, 'apps/astro/', 'astro/set-html')

  const astroInlineScript = rulePaths(result, 'astro/inline-script')
  assert.ok(astroInlineScript.includes('apps/astro/src/pages/index.astro'))
  assert.equal(astroInlineScript.includes('apps/web/decoy.astro'), false)
  assertAllPrefixed(astroInlineScript, 'apps/astro/', 'astro/inline-script')

  const rnManifestPaths = rulePaths(result, 'rn/cleartext-traffic')
  assert.ok(rnManifestPaths.includes('apps/rn/android/app/AndroidManifest.xml'))
  assert.equal(rnManifestPaths.includes('apps/web/android/app/AndroidManifest.xml'), false)
  assertAllPrefixed(rnManifestPaths, 'apps/rn/', 'rn/cleartext-traffic')

  const rnAtsPaths = rulePaths(result, 'rn/ats-arbitrary-loads')
  assert.ok(rnAtsPaths.includes('apps/rn/Info.plist'))
  assert.equal(rnAtsPaths.includes('apps/web/Info.plist'), false)
  assertAllPrefixed(rnAtsPaths, 'apps/rn/', 'rn/ats-arbitrary-loads')

  const expoTokenPaths = rulePaths(result, 'rn/asyncstorage-token-key')
  assert.ok(expoTokenPaths.includes('apps/expo/src.ts'))
  assert.equal(expoTokenPaths.includes('apps/web/src/decoy-rn.ts'), false)
  assertAllPrefixed(expoTokenPaths, ['apps/expo/', 'apps/rn/'], 'rn/asyncstorage-token-key')
})
