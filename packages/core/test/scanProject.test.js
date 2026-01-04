const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const { scanProject } = require('../dist/index.js')

test('scanProject finds builtin rule matches', async () => {
  const fixtureRoot = path.join(__dirname, 'fixtures', 'sample-repo')
  const result = await scanProject({ rootDir: fixtureRoot })

  const ruleIds = result.findings.map((f) => f.ruleId)
  assert.ok(ruleIds.includes('core/env-file-committed'))
  assert.ok(ruleIds.includes('core/private-key-committed'))
  assert.ok(ruleIds.includes('core/hardcoded-aws-access-key-id'))
})
