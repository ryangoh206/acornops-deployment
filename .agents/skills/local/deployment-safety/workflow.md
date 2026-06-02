# Deployment Safety Workflow

1. Diff compose and script changes by profile.
2. Verify env variable additions keep secure defaults.
3. Run `task validate` before merge.
4. For profile changes, run `task local-up` or `task prod-up` in a safe environment.
5. Validate `task local-down` or `task prod-down` still cleanly tears down.
6. Update `release/stack-versions.yaml` when compatibility expectations change.
