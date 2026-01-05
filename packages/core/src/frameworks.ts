import { readFile, stat } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import path from 'node:path'

import type { FrameworkDetection, FrameworkId } from './types'

type PackageJson = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

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

export async function detectFrameworks(rootDir: string): Promise<FrameworkDetection[]> {
  const pkg = await readPackageJson(rootDir)

  const nextEvidence: string[] = []
  pushIf('dependency: next', packageHasDep(pkg, 'next'), nextEvidence)
  pushIf('file: next-env.d.ts', await hasFile(rootDir, 'next-env.d.ts'), nextEvidence)
  pushIf('dir: app/', await hasDir(rootDir, 'app'), nextEvidence)
  pushIf('dir: pages/', await hasDir(rootDir, 'pages'), nextEvidence)

  const nextConfigFiles = ['next.config.js', 'next.config.mjs', 'next.config.cjs', 'next.config.ts']
  for (const f of nextConfigFiles) {
    pushIf(`file: ${f}`, await hasFile(rootDir, f), nextEvidence)
  }

  const rnEvidence: string[] = []
  pushIf('dependency: react-native', packageHasDep(pkg, 'react-native'), rnEvidence)
  pushIf('dir: ios/', await hasDir(rootDir, 'ios'), rnEvidence)
  pushIf('dir: android/', await hasDir(rootDir, 'android'), rnEvidence)
  pushIf('file: metro.config.js', await hasFile(rootDir, 'metro.config.js'), rnEvidence)

  const expoEvidence: string[] = []
  pushIf('dependency: expo', packageHasDep(pkg, 'expo'), expoEvidence)
  pushIf('file: app.json', await hasFile(rootDir, 'app.json'), expoEvidence)
  pushIf('file: app.config.js', await hasFile(rootDir, 'app.config.js'), expoEvidence)
  pushIf('file: app.config.ts', await hasFile(rootDir, 'app.config.ts'), expoEvidence)
  pushIf('file: eas.json', await hasFile(rootDir, 'eas.json'), expoEvidence)

  const frameworks: FrameworkDetection[] = []

  if (nextEvidence.length > 0) frameworks.push(makeDetection('nextjs', nextEvidence))

  if (rnEvidence.length > 0) {
    const combined = Array.from(new Set([...rnEvidence, ...expoEvidence]))
    frameworks.push(makeDetection('react-native', combined))
  }

  if (expoEvidence.length > 0) frameworks.push(makeDetection('expo', expoEvidence))

  frameworks.sort((a, b) => {
    const score = (d: FrameworkDetection) =>
      d.confidence === 'high' ? 3 : d.confidence === 'medium' ? 2 : 1
    return score(b) - score(a)
  })

  return frameworks
}
