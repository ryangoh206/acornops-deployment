# Deployment Plans

Execution plans are first-class repository artifacts for work that spans multiple steps, decisions, or validation loops.

## Locations

- [Active Plans](/docs/exec-plans/active/README.md)
- [Completed Plans](/docs/exec-plans/completed/README.md)
- [Tech Debt Tracker](/docs/exec-plans/tech-debt-tracker.md)

## Rules

- Create an active plan before changing compose topology, production env contracts, release compatibility metadata, Kubernetes platform behavior, or agent deployment behavior across multiple files.
- Record decisions, risks, and validation notes in the plan itself.
- Move the plan to `completed/` when the work lands.
- Record leftover follow-up work in the tech debt tracker.
