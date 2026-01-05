import type { Rule } from '@reliabilityworks/core'

export const JAVASCRIPT_RULES: Rule[] = [
  {
    id: 'javascript/dangerous-eval',
    severity: 'high',
    title: 'Use of eval()',
    description: 'eval() can execute arbitrary code and is often a sign of injection risk.',
    matcher: {
      type: 'regex',
      fileGlobs: ['**/*.{js,jsx,ts,tsx}'],
      pattern: '\\beval\\s*\\(',
      message: 'eval() usage detected',
    },
  },
  {
    id: 'javascript/dangerous-new-function',
    severity: 'high',
    title: 'Use of new Function()',
    description: 'The Function constructor evaluates strings as code and can lead to injection.',
    matcher: {
      type: 'regex',
      fileGlobs: ['**/*.{js,jsx,ts,tsx}'],
      pattern: '\\bnew\\s+Function\\s*\\(',
      message: 'new Function() usage detected',
    },
  },
  {
    id: 'javascript/child-process-exec',
    severity: 'high',
    title: 'Use of child_process.exec/execSync',
    description:
      'Executing shell commands from application code can be risky, especially with user-controlled input.',
    matcher: {
      type: 'regex',
      fileGlobs: ['**/*.{js,jsx,ts,tsx}'],
      pattern: '\\bchild_process\\.(?:exec|execSync)\\s*\\(',
      message: 'child_process.exec or child_process.execSync usage detected',
    },
  },
  {
    id: 'javascript/tls-reject-unauthorized-disabled',
    severity: 'critical',
    title: 'TLS verification disabled',
    description: 'Disabling TLS verification allows man-in-the-middle attacks.',
    matcher: {
      type: 'regex',
      fileGlobs: ['**/*.{js,jsx,ts,tsx}'],
      pattern: '\\bNODE_TLS_REJECT_UNAUTHORIZED\\s*=\\s*[\'"]?0[\'"]?',
      message: 'NODE_TLS_REJECT_UNAUTHORIZED is set to 0',
    },
  },
  {
    id: 'javascript/reject-unauthorized-false',
    severity: 'high',
    title: 'rejectUnauthorized set to false',
    description: 'Setting rejectUnauthorized: false disables TLS certificate verification.',
    matcher: {
      type: 'regex',
      fileGlobs: ['**/*.{js,jsx,ts,tsx}'],
      pattern: '\\brejectUnauthorized\\s*:\\s*false\\b',
      message: 'rejectUnauthorized appears to be set to false',
    },
  },
]

export function getJavaScriptRules(): Rule[] {
  return JAVASCRIPT_RULES
}
