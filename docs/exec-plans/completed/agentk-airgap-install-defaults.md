# AgentK Air-Gapped Install Defaults

## Goal

Expose platform Helm settings that feed safe downstream AgentK chart values
and an optional local CA path into generated cluster installation commands.

## Decisions

- Preserve existing `agent.helm` keys and defaults.
- Serialize downstream values as JSON for the control plane.
- Keep the local file path distinct from literal chart values.
- Document internal chart and image mirror configuration.

## Validation

- `task validate` passed.
- `task platform-contracts` passed.
- Platform Helm lint, rendering, schema, and release-matrix checks passed.

