# Platform provider endpoint overrides

## Goal

Expose the llm-gateway's optional provider base URLs through supported VM Compose
and Helm deployment configuration.

## Work

- Forward the three environment variables in local and production Compose.
- Add typed Helm values and render them into the gateway ConfigMap.
- Document usage and native API compatibility requirements.

## Validation

- Deployment contract checks
- Helm chart checks
- `task validate`
