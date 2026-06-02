---
name: acornops-deployment-google-style
description: Apply Google Shell Style Guide conventions to AcornOps deployment scripts and keep YAML/compose/task definitions consistent and readable. Use when editing Taskfile entries, shell scripts under scripts/, compose files, or deployment runbooks.
---

# Inputs

- changed shell, Taskfile, and YAML files
- deployment track context (`local`, `prod`, `agent`)
- existing operational command patterns

# Procedure

1. Apply Google Shell Style principles to shell scripts: strict mode, clear naming, quoting, small functions, and explicit error handling.
2. Keep command blocks readable and avoid dense one-liners when behavior is non-trivial.
3. Preserve existing environment variable naming and defaulting patterns.
4. Keep YAML and Taskfile entries consistent in naming, indentation, and key grouping.
5. Run deployment validation commands before finalizing changes.

# Outputs

- style conformance summary
- list of readability or consistency fixes applied
- validation commands executed
