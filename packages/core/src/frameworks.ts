import { readFile, stat } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import path from 'node:path'

import fg from 'fast-glob'

import type { FrameworkDetection, FrameworkId } from './types'

type PackageJson = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const WORKSPACE_IGNORES = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/.yarn/**',
  '**/.pnpm/**',
]

async function pathStat(p: string): Promise<Stats | null> {
  try {
    return await stat(p)
  } catch {
    return null
  }
}

async function hasFile(rootDir: string, relativePath: string): Promise<boolean> {
  const fileStat = await pathStat(path.join(rootDir, relativePath))
  return fileStat?.isFile() ?? false
}

async function hasDir(rootDir: string, relativePath: string): Promise<boolean> {
  const dirStat = await pathStat(path.join(rootDir, relativePath))
  return dirStat?.isDirectory() ?? false
}

async function readPackageJson(rootDir: string): Promise<PackageJson | null> {
  const packageJsonPath = path.join(rootDir, 'package.json')
  const fileStat = await pathStat(packageJsonPath)
  if (!fileStat?.isFile()) return null

  try {
    const raw = await readFile(packageJsonPath, 'utf8')
    return JSON.parse(raw) as PackageJson
  } catch {
    return null
  }
}

function packageHasDep(pkg: PackageJson | null, name: string): boolean {
  if (!pkg) return false
  return Boolean(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name])
}

function pushIf(value: string, condition: boolean, into: string[]) {
  if (condition) into.push(value)
}

function confidenceFromEvidenceCount(count: number): FrameworkDetection['confidence'] {
  if (count >= 3) return 'high'
  if (count >= 2) return 'medium'
  return 'low'
}

function makeDetection(id: FrameworkId, evidence: string[]): FrameworkDetection {
  return {
    id,
    confidence: confidenceFromEvidenceCount(evidence.length),
    evidence,
  }
}

function sortFrameworks(frameworks: FrameworkDetection[]): void {
  frameworks.sort((a, b) => {
    const score = (d: FrameworkDetection) =>
      d.confidence === 'high' ? 3 : d.confidence === 'medium' ? 2 : 1
    return score(b) - score(a)
  })
}

export async function detectFrameworks(rootDir: string): Promise<FrameworkDetection[]> {
  const pkg = await readPackageJson(rootDir)

  const hasNextDep = packageHasDep(pkg, 'next')
  const hasNextEnv = await hasFile(rootDir, 'next-env.d.ts')

  const nextEvidence: string[] = []
  pushIf('dependency: next', hasNextDep, nextEvidence)
  pushIf('file: next-env.d.ts', hasNextEnv, nextEvidence)
  pushIf('dir: app/', await hasDir(rootDir, 'app'), nextEvidence)
  pushIf('dir: pages/', await hasDir(rootDir, 'pages'), nextEvidence)

  const nextConfigFiles = ['next.config.js', 'next.config.mjs', 'next.config.cjs', 'next.config.ts']
  for (const f of nextConfigFiles) {
    pushIf(`file: ${f}`, await hasFile(rootDir, f), nextEvidence)
  }

  const hasReactNativeDep = packageHasDep(pkg, 'react-native')

  const rnEvidence: string[] = []
  pushIf('dependency: react-native', hasReactNativeDep, rnEvidence)
  pushIf('dir: ios/', await hasDir(rootDir, 'ios'), rnEvidence)
  pushIf('dir: android/', await hasDir(rootDir, 'android'), rnEvidence)
  pushIf('file: metro.config.js', await hasFile(rootDir, 'metro.config.js'), rnEvidence)

  const expoEvidence: string[] = []
  pushIf('dependency: expo', packageHasDep(pkg, 'expo'), expoEvidence)
  pushIf('file: app.json', await hasFile(rootDir, 'app.json'), expoEvidence)
  pushIf('file: app.config.js', await hasFile(rootDir, 'app.config.js'), expoEvidence)
  pushIf('file: app.config.ts', await hasFile(rootDir, 'app.config.ts'), expoEvidence)
  pushIf('file: eas.json', await hasFile(rootDir, 'eas.json'), expoEvidence)

  const expressEvidence: string[] = []
  pushIf('dependency: express', packageHasDep(pkg, 'express'), expressEvidence)

  const hasSvelteKitDep = packageHasDep(pkg, '@sveltejs/kit')

  const kitEvidence: string[] = []
  pushIf('dependency: @sveltejs/kit', hasSvelteKitDep, kitEvidence)
  pushIf('file: svelte.config.js', await hasFile(rootDir, 'svelte.config.js'), kitEvidence)
  pushIf('file: svelte.config.ts', await hasFile(rootDir, 'svelte.config.ts'), kitEvidence)
  pushIf('dir: src/routes/', await hasDir(rootDir, path.join('src', 'routes')), kitEvidence)

  const frameworks: FrameworkDetection[] = []

  if (hasNextDep || hasNextEnv) frameworks.push(makeDetection('nextjs', nextEvidence))

  if (hasReactNativeDep) {
    const combined = Array.from(new Set([...rnEvidence, ...expoEvidence]))
    frameworks.push(makeDetection('react-native', combined))
  }

  if (expoEvidence.length > 0) frameworks.push(makeDetection('expo', expoEvidence))

  if (expressEvidence.length > 0) frameworks.push(makeDetection('express', expressEvidence))

  if (hasSvelteKitDep) frameworks.push(makeDetection('sveltekit', kitEvidence))

  sortFrameworks(frameworks)

  return frameworks
}

export async function listWorkspaceProjectRoots(rootDir: string): Promise<string[]> {
  const packageJsonPaths = await fg('**/package.json', {
    cwd: rootDir,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: WORKSPACE_IGNORES,
  })

  const resolvedRoot = path.resolve(rootDir)

  const roots = Array.from(
    new Set(packageJsonPaths.map((relativePath) => path.join(rootDir, path.dirname(relativePath)))),
  )
    .map((p) => path.resolve(p))
    .filter((p) => p !== resolvedRoot)

  roots.sort()

  return roots
}

export async function detectFrameworksInWorkspace(rootDir: string): Promise<FrameworkDetection[]> {
  const roots = await listWorkspaceProjectRoots(rootDir)

  const byFramework = new Map<FrameworkId, Set<string>>()

  for (const projectRoot of roots) {
    const detections = await detectFrameworks(projectRoot)
    if (detections.length === 0) continue

    const relativeRoot = path.relative(rootDir, projectRoot) || '.'
    for (const detection of detections) {
      const existing = byFramework.get(detection.id) ?? new Set<string>()
      for (const evidence of detection.evidence) {
        existing.add(`${relativeRoot}: ${evidence}`)
      }
      byFramework.set(detection.id, existing)
    }
  }

  const frameworks: FrameworkDetection[] = []

  for (const [id, evidenceSet] of byFramework.entries()) {
    frameworks.push(makeDetection(id, Array.from(evidenceSet)))
  }

  sortFrameworks(frameworks)

  return frameworks
}
