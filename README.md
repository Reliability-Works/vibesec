# VibeSec

Local-first security scanner for modern app frameworks.

## Dev

- Install: `pnpm install`
- Build: `pnpm build`
- Scan: `node packages/cli/dist/cli.js scan .`

## GitHub Action

Until public release, pin to a pre-release tag (e.g. `v0.1.0-alpha.1`) or a commit SHA.

```yaml
- uses: Reliability-Works/vibesec@v0.1.0-alpha.1
  with:
    path: .
    framework: auto
    output: sarif
    out-file: vibesec.sarif
    fail-on: high
```

## Docker

- Build locally: `docker build -t vibesec -f docker/Dockerfile .`
- Run: `docker run --rm -v "$PWD:/repo" -w /repo vibesec scan .`
- Pull from GHCR (tagged builds only): `docker pull ghcr.io/reliability-works/vibesec:v0.1.0-alpha.1`

## Config

VibeSec looks for `.vibesec.yaml` in the scan root.

## Safety model

VibeSec must never execute any code from the repository being scanned. Custom rules from `.vibesec/rules/` are declarative-only.
