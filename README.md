# VibeSec

Local-first security scanner for modern app frameworks.

## Installation

### Global installation (recommended)

```bash
npm install -g @reliabilityworks/vibesec
```

This installs the `vibesec` CLI so you can run:

```bash
vibesec scan .
```

### Optional: build from source

For development or contributing:

```bash
git clone https://github.com/Reliability-Works/vibesec.git
cd vibesec
pnpm install
pnpm build
cd packages/cli
npm link
```

Then run from anywhere:

```bash
vibesec scan .
```

## Dev

- Install: `pnpm install`
- Build: `pnpm build`
- Scan: `node packages/cli/dist/cli.js scan .`

## GitHub Action

Use the moving major tag to stay on the latest stable release:

```yaml
- uses: Reliability-Works/vibesec@v1
  with:
    path: .
    framework: auto
    output: sarif
    out-file: vibesec.sarif
    fail-on: high
```

If you need fully reproducible builds, pin to a specific version tag (e.g. `v1.0.0`) or a commit SHA.

## Docker

- Build locally: `docker build -t vibesec -f docker/Dockerfile .`
- Run: `docker run --rm -v "$PWD:/repo" -w /repo vibesec scan .`
- Pull from GHCR: `docker pull ghcr.io/reliability-works/vibesec:latest`

If you need fully reproducible builds, pin to a specific version tag (e.g. `ghcr.io/reliability-works/vibesec:v1.0.0`).

## Config

VibeSec looks for `.vibesec.yaml` in the scan root.

## Safety model

VibeSec must never execute any code from the repository being scanned. Custom rules from `.vibesec/rules/` are declarative-only.
