# Security Policy

## Reporting Security Issues

Report suspected vulnerabilities privately to `security@attomus.com`. You can
also use a private vulnerability report from this repository's **Security** tab.

Please include reproduction steps, the affected version, the expected impact,
and any relevant workflow excerpts, test vectors, or wire bytes. Do not include
real credentials, tokens, private keys, or customer data, and do not open a
public issue for a suspected vulnerability.

## Supported Versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| Pre-release versions earlier than 1.0.0 | No |

Security fixes are made against the latest compatible v1 release. Users should
follow the floating `v1` tag or update to the latest `v1.x.x` tag.

## Scope

In scope:

- the Action and bootstrap Action code in this repository;
- the `@attomus/semafore-crypto` code bundled into `dist/`;
- handling of service tokens, device keys, and bootstrap key material; and
- the encrypted notification and execute wire formats emitted by the Action.

Out of scope:

- vulnerabilities in GitHub Actions or a reporter's own workflow configuration
  that are not caused by this Action;
- general SemaFore product or infrastructure issues, which should be reported
  through the [main SemaFore disclosure policy](https://attomus.com/security/);
  and
- vulnerabilities in third-party dependencies that do not arise from how this
  Action uses them, which should be reported to the upstream maintainer.

## Response Commitment

Attomus aims to acknowledge reports within 48 hours and provide an initial
assessment, including severity and an expected remediation timeline, within
7 days. We will coordinate a fix and disclosure date with the reporter
before details are made public.
