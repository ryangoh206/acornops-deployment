# OIDC Additional CA Trust

## Objective

Add a typed Helm values contract that lets the control-plane trust an
operator-managed ConfigMap or Secret CA bundle for OIDC without disabling TLS
verification or replacing Node.js's public CA trust.

## Scope

- Add nullable, mutually exclusive ConfigMap and Secret key references under
  `auth.oidc.tls.additionalCaBundle`.
- Validate the contract in JSON Schema and again in Helm templates.
- Mount the selected key read-only at
  `/etc/acornops/trust/oidc-ca.pem` and set chart-owned
  `NODE_EXTRA_CA_CERTS` for the control-plane container.
- Add rendering, schema, strict-lint, internal-mTLS-independence, and escape-
  hatch regression coverage.
- Document setup, namespace ownership, trust-manager consumption, rotation,
  restart behavior, and troubleshooting.
- Record the new operator contract in the deployment contract manifest.

## Boundaries

- Do not add TLS-verification bypasses, inline PEM values, private keys, client
  certificates, cross-namespace copying, ClusterTrustBundle support, generic
  volume escape hatches, dynamic reload, Helm `lookup` checksums, or
  application-level OIDC TLS clients or diagnostics.
- Do not edit the generated `charts` mirror. Packaging, publication, mirror
  regeneration, deployment pin adoption, and live-cluster verification happen
  through the existing release and rollout workflows.
- Keep internal service-to-service mTLS independent from OIDC issuer trust.

## Verification

- `task k8s-chart-check`
- `task contracts:check`
- `task platform-contracts`
- `task harness:check`
- `task validate`
- Inspect default, ConfigMap, Secret, ambiguous, incomplete, and combined
  internal-TLS renders.
- Report live private-CA OIDC, wrong-CA, missing-resource, public-CA, and
  rotation scenarios as environment-dependent if no suitable cluster and
  identity provider are available.

## Status

Chart release and source metadata adoption validated; environment rollout pending.

Local evidence:

- `task k8s-chart-check` passed.
- `task contracts:check` and `task platform-contracts` passed with cross-repo
  comparison skipped because declared sibling checkouts are missing.
- `task harness:check` and `task validate` passed.
- Default, ConfigMap, Secret, ambiguous, incomplete, disabled-control-plane,
  internal-mTLS coexistence, and extra-env rendering cases passed their expected
  assertions.
- Draft PR #8 passed CI and merged to `main` at `503fe9b`.
- Release tag `v0.0.1-experimental.6` published the OCI chart with digest
  `sha256:bae907e49613d986ae8fb045544cba4144f5a73e271d6bdf4df785a76605e8bb`.
- The classic chart mirror published package digest
  `5d9b17b2a8231c5b8e5daefa469037bd584770967f00113785f1ed5cc881e26a`;
  its index entry matches and the GitHub Pages package URL returns HTTP 200.
- `Chart.yaml` and the Kubernetes stack release pin now track the published
  `0.0.1-experimental.6` chart.

Remaining external evidence requires the internal Artifactory mirror, the
target namespace's trust resource and NetworkPolicy, a deployed OIDC provider,
and the live public/private/wrong/missing/rotation scenarios.
