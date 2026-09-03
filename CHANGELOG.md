# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - Unreleased

### Added

- Initial public release of SemaFore for GitHub Actions.
- Notify mode with recipient resolution and per-device X3DH/Double Ratchet
  encryption before delivery through the ADR-0166 integration API.
- Execute mode with `create_thread`, `archive_thread`, and `audit_event` actions.
- Bootstrap Action for one-time device registration, local key generation, and
  encrypted writeback to GitHub Actions secrets.
- Sensitive-input origin and placeholder checks, log masking, bounded HTTP
  timeouts, and retries for safe transient failures.
- GitHub repository-secret helper with public-key fetch, libsodium sealed-box
  encryption, and create-or-update support.
- Bundled `dist/` runtime containing `@attomus/semafore-crypto` v1.0.1 inline.
- CI verification for linting, type-checking, tests, bundle freshness,
  dependency audit, and secret scanning.

### Security

- Notification content is end-to-end encrypted in the GitHub runner for each
  recipient device using X3DH and Double Ratchet; SemaFore routes ciphertext
  envelopes and cannot read the notification content.
- Bootstrap private-key material is generated in the runner and sealed to
  GitHub's repository public key before upload.
- The committed runtime bundle is excluded from duplicate gitleaks inspection;
  its source and the remainder of the full Git history remain scanned.

### Dependencies

- Runtime dependency on `@attomus/semafore-crypto` `^1.0.0`.

[Unreleased]: https://github.com/Attomus/semafore-github-action/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Attomus/semafore-github-action/releases/tag/v1.0.0
