---
name: acornops-deployment-safety
description: Guard deployment repository changes affecting compose topology, profile wiring, environment contracts, and rollout scripts. Use when modifying compose files, Taskfile tasks, environment templates, release compatibility metadata, or deployment automation.
---

# Inputs

- changed compose, script, and env files
- target deployment track (`local`, `prod`, `agent`)
- release compatibility expectations

# Procedure

1. Identify which deployment track and profile behavior is affected.
2. Keep profile and env changes backward compatible when feasible.
3. Validate compose rendering and startup/teardown command safety.
4. Verify rollout and rollback behavior remains clear.
5. Update runbooks and compatibility metadata for operational changes.

# Outputs

- deployment risk summary
- required validation command checklist
- rollback and operator notes
