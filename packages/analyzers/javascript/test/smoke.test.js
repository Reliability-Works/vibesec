const assert = require('node:assert/strict')
const test = require('node:test')

test('analyzer exports javascript rules', async () => {
  const mod = require('../dist/index.js')
  assert.ok(mod)

  assert.equal(typeof mod.getJavaScriptRules, 'function')
  const rules = mod.getJavaScriptRules()
  assert.ok(Array.isArray(rules))
  assert.ok(rules.length > 0)

  const ids = new Set(rules.map((r) => r.id))
  assert.ok(ids.has('javascript/dangerous-eval'))
  assert.ok(ids.has('javascript/tls-reject-unauthorized-disabled'))
})
