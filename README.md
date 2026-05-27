# SemaFore - End-to-End Encrypted Notifications for GitHub Actions

Send workflow notifications from GitHub Actions into SemaFore without handing
the message body to a notification vendor.

SemaFore is end-to-end encrypted operational messaging for organisations. This
Action is the GitHub runner-side bridge: it prepares workflow messages where
the workflow runs, encrypts them for your SemaFore recipients, and hands
SemaFore servers encrypted envelopes to deliver.

## Status

This repository is public and in active development. It is not Marketplace-ready
yet.

Implemented today:

- Action metadata and Node 20 entrypoint
- main Action plus `bootstrap/` sub-action
- input parsing and mode dispatch for `notify`, `execute`, and `bootstrap`
- defensive checks for obvious non-secret sensitive inputs
- GitHub Actions log masking for service tokens and device keys
- shorthand template rendering for workflow context values
- execute-mode HTTP client
- bootstrap GitHub secret lookup and idempotency guard
- bundled `dist/` output
- lint, type-check, test, build, audit, and release workflows

Blocked until upstreams are live:

- notify-mode recipient encryption using `@attomus/semafore-crypto@1.0.0`
- bootstrap key generation and encrypted secret write
- staging end-to-end runs against the SemaFore integration endpoints
- Marketplace release, screenshots, and floating `v1` tag

The public API, inputs, and examples may change before the first Marketplace
release.

## Quick Notify Example

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

Bootstrap is designed to create this repository's SemaFore device key material
inside the GitHub Actions runner, register the public key bundle with SemaFore,
and store the private device state in GitHub Actions secrets. It refuses to
overwrite `SEMAFORE_DEVICE_KEY`; revoke the old device first, then bootstrap
again.

## Inputs

| Input | Required | Modes | Description |
|---|---:|---|---|
| `token` | yes | notify, execute, bootstrap via main Action | SemaFore service token. Must come from `secrets.SEMAFORE_TOKEN`. |
| `bootstrap_token` | bootstrap sub-action only | bootstrap | Bootstrap-capability token. Must come from `secrets.SEMAFORE_BOOTSTRAP_TOKEN`. |
| `device_key` | notify only | notify | SemaFore device private state. Must come from `secrets.SEMAFORE_DEVICE_KEY`. |
| `mode` | yes | all | `notify`, `execute`, or `bootstrap`. |
| `target` | notify only | notify | `org`, `group:<id>`, or `user:<id>`. |
| `template` | notify only | notify | Message template. GitHub expressions resolve before the Action runs. |
| `action` | execute only | execute | `create_thread`, `archive_thread`, or `audit_event`. |
| `params` | optional | execute | JSON object for the execute action. |
| `severity` | optional | notify | Optional severity label. |
| `api_base_url` | optional | all | Override for staging or test servers. |
| `github_token` | bootstrap only | bootstrap | GitHub token with `actions: write` permission. |

## Outputs

| Output | Mode | Description |
|---|---|---|
| `message_id` | notify | SemaFore message identifier when returned by the server. |
| `result` | execute | JSON result returned by the execute endpoint. |
| `device_id` | bootstrap | Registered SemaFore device identifier. |

## Execute Actions

- `create_thread` posts to `/api/integrations/execute/thread/create`.
- `archive_thread` posts to `/api/integrations/execute/thread/archive/{thread_id}`.
- `audit_event` posts to `/api/integrations/execute/audit/event`.

Execute mode is for workflow events that naturally run inside GitHub Actions:
pushes, pull requests, deployments, schedules, and manual dispatches. Webhook
style events that do not run a workflow step cleanly are v2 GitHub App territory.

## Templates

GitHub resolves `${{ github.* }}` expressions before this Action starts. The
Action also supports a small shorthand set:

- `{{run_id}}`
- `{{ref}}`
- `{{sha}}`
- `{{actor}}`
- `{{workflow}}`
- `{{repository}}`

Unknown shorthand values render as an empty string.

## Security Model

- Notification content is encrypted in the GitHub runner before transport.
- SemaFore servers receive encrypted envelopes, not notification plaintext.
- Service tokens and device keys must be stored as GitHub Actions secrets.
- Sensitive inputs are registered with the GitHub Actions masking API at
  startup.
- The Action rejects obvious placeholder or literal-looking sensitive inputs.

GitHub's JavaScript Action runtime does not expose a reliable "this input came
from `secrets.*`" marker to the Action process. The runtime check is therefore a
defensive guardrail, not a proof. The real requirement is operational: put
`SEMAFORE_TOKEN`, `SEMAFORE_DEVICE_KEY`, and `SEMAFORE_BOOTSTRAP_TOKEN` in GitHub
Actions secrets and reference them from `secrets.*`.

## Pricing

The Action is intended to be free on GitHub Marketplace. It requires a SemaFore
organisation account; SemaFore plan limits and billing live in SemaFore, not in
Marketplace tiers.

## Versioning

Tagged `v1.x.x` releases become Marketplace versions once the Action is ready.
The floating `v1` tag points to the latest compatible v1 release.

## Responsible Disclosure

Please report security issues privately. See [SECURITY.md](./SECURITY.md).

## License

Apache-2.0.
