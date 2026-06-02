# Repository Structure Rationale

## Why Keep Local + Production in One Deployment Repo

1. Single source of truth for operators and contributors
2. Shared domain/routing and service dependency model
3. Easier version compatibility control

## Guardrails Used

1. Separate compose tracks by intent (`local` vs `vm-prod`)
2. Separate env templates by deployment track (`env/local`, `env/vm`, `env/k8s`)
3. Explicit boundaries between VM, Kubernetes platform, and workload-cluster deployment tracks

## Direction

1. Maintain Helm charts under `kubernetes/helm/`
2. Keep VM compose as a supported self-host path
3. Add CI checks for compose render + smoke tests + chart lint/template
