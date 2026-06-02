# Quality Score

| Area | Score | Evidence | Main Gap |
| --- | --- | --- | --- |
| Deployment topology | 8 | Compose profiles, Taskfile entrypoints, and Kubernetes chart paths are documented. | Remote-cluster install smoke coverage should be expanded. |
| Local developer path | 8 | `task install`, `task doctor`, and `task local-up` provide a clear contributor flow. | Cross-repo contract checks require sibling repos to be present. |
| Production readiness | 7 | VM production track validates compose rendering and rejects placeholder secrets at runtime. | Backup and restore drills need formal runbooks. |
| Harness maturity | 8 | Docs, contracts, Python service standards, and harness checks live in the repo. | CI should run platform checks with sibling repos checked out. |
