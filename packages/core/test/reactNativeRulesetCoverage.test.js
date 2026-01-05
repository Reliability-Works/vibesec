const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const test = require('node:test')

const { scanProject } = require('../dist/index.js')

test('react-native ruleset has fixture coverage', async () => {
  const fixtureRoot = path.join(__dirname, 'fixtures', 'monorepo', 'apps', 'rn')
  const rulesPath = path.join(__dirname, '..', '..', 'rulesets', 'react-native', 'rules.json')

  const raw = await fs.readFile(rulesPath, 'utf8')
  const rules = JSON.parse(raw)

  assert.ok(Array.isArray(rules))
  assert.ok(rules.length >= 60, `Expected at least 60 react-native rules, got ${rules.length}`)

  const expectedIds = rules.map((r) => r.id)
  const result = await scanProject({
    rootDir: fixtureRoot,
    pathBaseDir: fixtureRoot,
    additionalRules: rules,
  })

  const foundIds = new Set(result.findings.map((finding) => finding.ruleId))
  const missing = expectedIds.filter((id) => !foundIds.has(id))

  assert.equal(
    missing.length,
    0,
    `Missing react-native fixture coverage for: ${missing.join(', ')}`,
  )
})
