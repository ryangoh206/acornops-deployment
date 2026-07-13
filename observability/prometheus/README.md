# Prometheus Rules

Load every rule file under `alerts/` into the Prometheus-compatible rule
evaluator used by the deployment environment. The platform does not install a
Prometheus server.

`control-plane-automation.rules.yaml` covers the production Agent and Workflow
objectives for dispatch backlog, scheduler lag, stale approvals, uncertain
writes, trigger rejection, MCP dependencies, PDF rendering, and terminal
outcomes. Scrape the control-plane `/metrics` endpoint from every replica so
per-process counters and the Postgres-derived runtime gauges are both visible.
