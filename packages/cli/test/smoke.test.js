const assert = require('node:assert/strict')
const test = require('node:test')

test('cli exports runCli', async () => {
  const cli = require('../dist/cli.js')
  assert.equal(typeof cli.runCli, 'function')
})
