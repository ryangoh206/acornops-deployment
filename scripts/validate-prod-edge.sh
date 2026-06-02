#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${ROOT_DIR}/compose/vm-prod/proxy/nginx.conf.template"

if [[ ! -f "${TEMPLATE}" ]]; then
  echo "Missing production nginx template: ${TEMPLATE}" >&2
  exit 1
fi

for forbidden in \
  '${CONTROL_PLANE_HOST}' \
  '${LLM_GATEWAY_HOST}' \
  '${EXECUTION_ENGINE_HOST}' \
  'proxy_pass http://llm-gateway:8001' \
  'proxy_pass http://execution-engine:8080'
do
  if grep -Fq "${forbidden}" "${TEMPLATE}"; then
    echo "Production edge exposes an internal-only service: ${forbidden}" >&2
    exit 1
  fi
done

for required in \
  'server_name ${MANAGEMENT_CONSOLE_HOST}' \
  'server_name ${API_HOST}' \
  'location /api/' \
  'proxy_pass http://control-plane:8081' \
  'Content-Security-Policy' \
  'Strict-Transport-Security' \
  'X-Content-Type-Options' \
  'Referrer-Policy' \
  'Permissions-Policy'
do
  if ! grep -Fq "${required}" "${TEMPLATE}"; then
    echo "Production edge is missing required public control-plane routing: ${required}" >&2
    exit 1
  fi
done

if grep -Fq '${MANAGEMENT_CONSOLE_PATH_PREFIX}' "${TEMPLATE}"; then
  echo "Production edge must serve the management console at the host root, not a path prefix" >&2
  exit 1
fi

old_api_host_var='$'
old_api_host_var="${old_api_host_var}{ACORNOPS""_HOST}"
if grep -Fq "${old_api_host_var}" "${TEMPLATE}" || grep -Fq "${old_api_host_var}" "${ROOT_DIR}/compose/vm-prod/compose.yaml"; then
  echo "Production edge should use API_HOST for the public control-plane host" >&2
  exit 1
fi

if grep -Fq 'Documentation site is not deployed yet' "${TEMPLATE}"; then
  echo "Production edge must not serve placeholder documentation content" >&2
  exit 1
fi

if ! grep -Fq 'MANAGEMENT_CONSOLE_UPSTREAM:-management-console:8080' "${ROOT_DIR}/compose/vm-prod/compose.yaml"; then
  echo "Production edge should target the non-root management console port 8080" >&2
  exit 1
fi

echo "Production edge exposure validation passed."
