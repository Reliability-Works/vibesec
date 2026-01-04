const assert = require('node:assert/strict')
const test = require('node:test')

test('analyzer package builds', async () => {
  const mod = require('../dist/index.js')
  assert.ok(mod)
})
