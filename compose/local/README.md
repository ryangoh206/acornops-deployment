# compose/local

`compose.source.yaml` is the local source-mounted overlay.

It is intended to be merged with `../vm-prod/compose.yaml` to run the full stack with hot reload and bind mounts.

Used by:

- `task local-up`
- `task local-down`
- `task local-reset`
