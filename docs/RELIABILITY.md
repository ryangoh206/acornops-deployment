# Reliability Rules

## Failure Modes

- Compose profile drift can start an incomplete stack.
- Migration job ordering mistakes can boot services against stale schemas.
- Edge proxy route mistakes can break SSO callbacks, API calls, or SPA deep links.
- Agent deployment env drift can point a cluster at the wrong control-plane URL.

## Required Validation

- Run `task validate` before finalizing deployment changes.
- Run `task contracts:check` when release metadata or platform compatibility changes.
- Run `task platform-contracts` when sibling AcornOps repositories are available.
- Run `task python-standards-check` when Python service Dockerfiles, CI workflows, lint settings, or dependency files change.
- Run `task local-ps` after `task local-up` and `task prod-ps` after `task prod-up`.

## Operational Rules

- Treat `local-reset`, `prod-down`, and `agent-remove` as destructive operations.
- Keep migration jobs in the bring-up path for both local and VM production tracks.
- Keep edge exposure narrow: browser/API traffic through the proxy, internal services on the Docker network.
- Treat external Redis as required for control-plane HA; it backs agent ownership, cross-pod command routing, run event fanout, and renewed scheduler leases.
- Keep Python service supply-chain and lint policy encoded in `scripts/check-python-service-standards.mjs`; update the harness when the shared standard intentionally changes.
