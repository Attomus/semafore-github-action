# SemaFore - End-to-End Encrypted Notifications for GitHub Actions

Post encrypted SemaFore workflow notifications from GitHub Actions without
sending plaintext message content through Attomus infrastructure.

## Status

This repository is scaffolded for Marketplace v1. End-to-end notify and
bootstrap execution are blocked until:

- `@attomus/semafore-crypto` is published to npm.
- sf-server integration ADRs 0165, 0166, and 0167 are live on staging.

The current implementation establishes the Action shape, input hardening,
execute dispatch, secret-writing helper, tests, and CI shell.

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

permissions:
  actions: write
  contents: read

jobs:
  bootstrap:
    runs-on: ubuntu-latest
    steps:
      - uses: attomus/semafore-github-action/bootstrap@v1
        with:
          bootstrap_token: ${{ secrets.SEMAFORE_BOOTSTRAP_TOKEN }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

Bootstrap refuses to overwrite `SEMAFORE_DEVICE_KEY` if it already exists. To
re-bootstrap, revoke the old SemaFore device first, remove the repository secret,
and run the bootstrap workflow again.

## Inputs

| Input | Required | Modes | Description |
|---|---:|---|---|
| `token` | yes | notify, execute | SemaFore service token stored as a GitHub Actions secret. |
| `device_key` | notify only | notify | Device private key stored as a GitHub Actions secret. |
| `mode` | yes | all | `notify`, `execute`, or `bootstrap`. |
| `target` | notify only | notify | `org`, `group:<id>`, or `user:<id>`. |
| `template` | notify only | notify | Message template. GitHub expressions resolve before the Action runs. |
| `action` | execute only | execute | `create_thread`, `archive_thread`, or `audit_event`. |
| `params` | optional | execute | JSON object for the execute action. |
| `severity` | optional | notify | Optional severity label. |
| `api_base_url` | optional | all | Override for staging or test servers. |

## Execute Actions

- `create_thread` posts to `/api/integrations/execute/thread/create`.
- `archive_thread` posts to `/api/integrations/execute/thread/archive/{thread_id}`.
- `audit_event` posts to `/api/integrations/execute/audit/event`.

## Security Model

- Notification content must be encrypted in the GitHub runner before it leaves
  the workflow environment.
- Service tokens and device keys must be stored as GitHub Actions secrets.
- Sensitive input values are registered with the GitHub Actions masking API at
  startup.
- Bootstrap follows Flow A from the project decisions: key material is generated
  inside the runner and written directly to GitHub repository secrets.

## Versioning

Tagged `v1.x.x` releases are Marketplace versions. The floating `v1` tag points
to the latest compatible v1 release.

## License

Apache-2.0.
