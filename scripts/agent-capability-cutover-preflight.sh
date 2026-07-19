#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_ENV_FILE="${ROOT_DIR}/env/vm/.env.prod"
ENV_FILE="${1:-${DEFAULT_ENV_FILE}}"
OUTPUT_DIR="${2:-${ROOT_DIR}/agent-capability-preflight}"
COMPOSE_FILE="${ROOT_DIR}/compose/vm-prod/compose.yaml"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  echo "Copy ${ROOT_DIR}/env/vm/.env.example to ${DEFAULT_ENV_FILE} and edit values." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

echo "Exporting secret-free Workflow V2 reset status and gateway capability inventories." >&2
set +e
docker compose -f "${COMPOSE_FILE}" --profile prod --env-file "${ENV_FILE}" \
  run --rm control-plane-init node dist/scripts/control-plane-db.js capabilities:preflight \
  > "${OUTPUT_DIR}/control-plane.json"
CONTROL_PLANE_PREFLIGHT_STATUS=$?
set -e
docker compose -f "${COMPOSE_FILE}" --profile prod --env-file "${ENV_FILE}" \
  run --rm llm-gateway-init python -m app.scripts.capability_preflight \
  > "${OUTPUT_DIR}/llm-gateway.json"

echo "Inventory written to ${OUTPUT_DIR}." >&2
if [[ "${CONTROL_PLANE_PREFLIGHT_STATUS}" -ne 0 ]]; then
  echo "WORKFLOW_V2_DATABASE_RESET_REQUIRED: back up, drop, and recreate the control-plane database before deployment." >&2
  exit "${CONTROL_PLANE_PREFLIGHT_STATUS}"
fi
echo "Preflight permits a first install or reset database. Deploy only the complete pinned Workflow V2 stack matrix." >&2
