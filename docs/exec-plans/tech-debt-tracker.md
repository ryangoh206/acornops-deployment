# Tech Debt Tracker

| Item | Impact | Next Step |
| --- | --- | --- |
| Platform Kubernetes deployment | VM deployment remains the supported production path. | Add Helm/Kubernetes architecture when the product is ready for that track. |
| Cross-repo CI harness | Platform checks are strongest in a sibling checkout. | Add CI that checks out all AcornOps repos before running `task platform-contracts`. |
