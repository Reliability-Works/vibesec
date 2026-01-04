# VibeSec

Local-first security scanner for modern app frameworks.

## Dev

- Install: `pnpm install`
- Build: `pnpm build`
- Scan: `node packages/cli/dist/cli.js scan .`

## Config

VibeSec looks for `.vibesec.yaml` in the scan root.

## Safety model

VibeSec must never execute any code from the repository being scanned. Custom rules from `.vibesec/rules/` are declarative-only.
