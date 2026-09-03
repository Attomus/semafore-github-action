# SemaFore - End-to-End Encrypted Notifications for GitHub Actions

GitHub Action for sending end-to-end encrypted SemaFore
notifications from GitHub Actions workflows.

The goal is simple: workflow messages should be encrypted in the GitHub runner
before they leave the customer's trust boundary. Attomus infrastructure should
route encrypted envelopes, not read notification content.

## Status

This repository is public, but it is not Marketplace-ready yet.

Implemented today:

- Action metadata and Node 20 entrypoint
- input parsing and mode dispatch
- secret-origin checks for sensitive inputs
- GitHub Actions log masking for tokens and device keys
- SemaFore execute-mode HTTP client
- notify-mode recipient resolution, per-device encryption, and ADR-0166 send
- bootstrap key generation, device registration, and encrypted GitHub secret writing
- runtime dependency on `@attomus/semafore-crypto`
- bundled `dist/` output
- lint, type-check, test, build, and audit workflow

Still in active development:

- end-to-end staging runs against the SemaFore integration endpoints
- Marketplace release packaging and `v1` tag movement

The public API, inputs, and examples may change before the first Marketplace
release.

See the [GitHub Actions integration guide](https://docs.semafore.io/integrations/github-actions/)
for bootstrap, setup, execute-mode reference, and troubleshooting.

## Notify Example

```yaml
name: Notify SemaFore

on:
  push:
    branches: [main]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: attomus/semafore-github-action@v1
        with:
          token: ${{ secrets.SEMAFORE_TOKEN }}
          device_key: ${{ secrets.SEMAFORE_DEVICE_KEY }}
          mode: notify
          target: org
          template: 'Build {{run_id}} on {{ref}} completed at ${{ github.sha }}'
```

## One-Time Bootstrap

```yaml
name: Bootstrap SemaFore

on:
  workflow_dispatch:

concurrency:
  group: semafore-bootstrap
  cancel-in-progress: false

jobs:
  bootstrap:
    runs-on: ubuntu-latest
    steps:
      - uses: attomus/semafore-github-action/bootstrap@v1
        with:
          bootstrap_token: ${{ secrets.SEMAFORE_BOOTSTRAP_TOKEN }}
          github_token: ${{ secrets.SEMAFORE_GITHUB_SECRET_TOKEN }}
```

Bootstrap creates the repository's SemaFore device key material in the runner
and stores it in GitHub Actions secrets. It refuses to overwrite
`SEMAFORE_DEVICE_KEY` if that secret already exists.

`SEMAFORE_GITHUB_SECRET_TOKEN` must be a fine-grained personal access token or
GitHub App installation token scoped to the repository with `Secrets: write`.
GitHub does not expose that permission through the workflow's built-in
`GITHUB_TOKEN`. After bootstrap succeeds, revoke the temporary token and delete
the `SEMAFORE_GITHUB_SECRET_TOKEN` repository secret.

## Inputs

| Input | Required | Modes | Description |
|---|---:|---|---|
| `token` | yes | notify, execute, bootstrap via root Action | SemaFore service token stored as a GitHub Actions secret. |
| `bootstrap_token` | bootstrap via root Action only | bootstrap | Bootstrap-capability token stored as a GitHub Actions secret. |
| `device_key` | notify only | notify | Device private key stored as a GitHub Actions secret. |
| `mode` | yes | all | `notify`, `execute`, or `bootstrap`. |
| `target` | notify only | notify | `org`, `group:<id>`, or `user:<id>`. |
| `template` | notify only | notify | Message template. GitHub expressions resolve before the Action runs. |
| `action` | execute only | execute | `create_thread`, `archive_thread`, or `audit_event`. |
| `params` | optional | execute | JSON object for the execute action. |
| `severity` | optional | notify | Reserved for a future wire-contract revision; omit for v1. |
| `api_base_url` | optional | all | Override for staging or test servers. |
| `github_token` | bootstrap only | bootstrap | Fine-grained PAT or GitHub App token with repository `Secrets: write` permission. |

## Execute Actions

- `create_thread` posts to `/api/integrations/execute/thread/create`.
- `archive_thread` posts to `/api/integrations/execute/thread/archive/{thread_id}`.
- `audit_event` posts to `/api/integrations/execute/audit/event`.

## Security Model

- Notification content is encrypted in the GitHub runner before transport.
- Bootstrap private-key material is generated in the runner and sealed with the
  repository's GitHub Actions secret-storage public key before upload.
- Service tokens and device keys must be stored as GitHub Actions secrets.
- Sensitive input values are registered with the GitHub Actions masking API at
  startup.
- The Action does not ask users to paste plaintext secrets into workflow files.

## Versioning

Tagged `v1.x.x` releases will become Marketplace versions once the Action is
ready. The floating `v1` tag will point to the latest compatible v1 release.
Release history is recorded in [CHANGELOG.md](./CHANGELOG.md).

## Responsible Disclosure

Please report security issues privately. See [SECURITY.md](./SECURITY.md).

## License

Apache-2.0.
