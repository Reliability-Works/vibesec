import type { Rule } from './types'

export const BUILTIN_RULES: Rule[] = [
  {
    id: 'core/env-file-committed',
    severity: 'critical',
    title: '.env file committed',
    description: 'Environment files often contain secrets and should not be committed.',
    matcher: {
      type: 'file_presence',
      paths: ['.env', '.env.*'],
      excludePaths: ['.env.example'],
      trackedOnly: true,
      message: 'Environment file tracked by git',
    },
  },
  {
    id: 'core/private-key-committed',
    severity: 'critical',
    title: 'Private key committed',
    description: 'Private keys should never be stored in repositories.',
    matcher: {
      type: 'regex',
      fileGlobs: ['**/*'],
      pattern: '-----BEGIN (?:RSA|EC|OPENSSH|DSA) PRIVATE KEY-----',
      message: 'Private key material detected',
    },
  },
  {
    id: 'core/hardcoded-aws-access-key-id',
    severity: 'high',
    title: 'Hardcoded AWS access key ID',
    description: 'AWS access key IDs should not be embedded in source code.',
    matcher: {
      type: 'regex',
      fileGlobs: ['**/*.{js,jsx,ts,tsx,json,yaml,yml,env,txt,md}'],
      pattern: '\\bAKIA[0-9A-Z]{16}\\b',
      message: 'Potential AWS access key ID detected',
    },
  },
]
