const assert = require('node:assert/strict')
const { execFile } = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { promisify } = require('node:util')

const { scanProject } = require('../dist/index.js')

const execFileAsync = promisify(execFile)

test('scanProject finds builtin rule matches', async () => {
  const fixtureRoot = path.join(__dirname, 'fixtures', 'sample-repo')
  const result = await scanProject({ rootDir: fixtureRoot })

  const ruleIds = result.findings.map((f) => f.ruleId)
  assert.ok(ruleIds.includes('core/env-file-committed'))
  assert.ok(ruleIds.includes('core/private-key-committed'))
  assert.ok(ruleIds.includes('core/hardcoded-aws-access-key-id'))
})

test('env-file-committed only flags tracked env files', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vibesec-env-rule-'))

  const commitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'vibesec',
    GIT_AUTHOR_EMAIL: 'vibesec@example.invalid',
    GIT_COMMITTER_NAME: 'vibesec',
    GIT_COMMITTER_EMAIL: 'vibesec@example.invalid',
  }

  await execFileAsync('git', ['init'], { cwd: repoRoot })
  await fs.writeFile(path.join(repoRoot, '.gitignore'), '.env\n.env.local\n')
  await fs.writeFile(path.join(repoRoot, '.env'), 'SECRET=1\n')
  await fs.writeFile(path.join(repoRoot, '.env.local'), 'SECRET_LOCAL=1\n')
  await fs.writeFile(path.join(repoRoot, '.env.example'), 'EXAMPLE=1\n')

  await execFileAsync('git', ['add', '.gitignore', '.env.example'], { cwd: repoRoot })
  await execFileAsync('git', ['commit', '-m', 'init'], { cwd: repoRoot, env: commitEnv })

  const untrackedResult = await scanProject({ rootDir: repoRoot })
  assert.equal(
    untrackedResult.findings.some((f) => f.ruleId === 'core/env-file-committed'),
    false,
  )

  await execFileAsync('git', ['add', '-f', '.env'], { cwd: repoRoot })
  await execFileAsync('git', ['commit', '-m', 'add env'], { cwd: repoRoot, env: commitEnv })

  const trackedResult = await scanProject({ rootDir: repoRoot })
  assert.equal(
    trackedResult.findings.some(
      (f) => f.ruleId === 'core/env-file-committed' && f.location.path === '.env',
    ),
    true,
  )
  assert.equal(
    trackedResult.findings.some(
      (f) => f.ruleId === 'core/env-file-committed' && f.location.path === '.env.example',
    ),
    false,
  )
})
