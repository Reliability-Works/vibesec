const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const { detectFrameworksInWorkspace } = require('../dist/index.js')

test('detectFrameworksInWorkspace finds nested frameworks', async () => {
  const fixtureRoot = path.join(__dirname, 'fixtures', 'monorepo')
  const frameworks = await detectFrameworksInWorkspace(fixtureRoot)

  const ids = frameworks.map((f) => f.id)
  assert.ok(ids.includes('nextjs'))
  assert.ok(ids.includes('express'))
  assert.ok(ids.includes('sveltekit'))
})
