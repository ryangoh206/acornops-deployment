# Deployment Google Style Workflow

1. Review changes under `scripts/`, `Taskfile.yml`, and compose YAML files.
2. Enforce shell readability: descriptive names, guarded conditionals, and safe quoting.
3. Prefer explicit logic over compact but opaque shell expressions.
4. Keep env var defaults and profile names consistent across scripts and compose files.
5. Run `task validate` and confirm no style regressions in changed scripts.
6. Document any intentional exceptions to style conventions.
