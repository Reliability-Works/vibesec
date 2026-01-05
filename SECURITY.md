# Security

## Reporting

If you discover a security issue, please report it privately.

- Email: security@reliabilityworks.co.uk

## Runtime safety boundary

VibeSec is designed to scan untrusted repositories safely.

- VibeSec must never execute any code from the repository being scanned.
- Custom rules loaded from `.vibesec/rules/` are declarative-only.
