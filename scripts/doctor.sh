#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/scripts/dev-bootstrap.sh"

failures=0
installable_gaps=0
ao_heading "Checking AcornOps local-up prerequisites..."

report_ok() {
  ao_ok "[ok] $1"
}

report_fixable() {
  ao_warn "[missing] $1"
  failures=1
  installable_gaps=1
}

report_blocker() {
  ao_error "[missing] $1"
  failures=1
}

check_command() {
  local cmd_name="$1"
  if command_exists "${cmd_name}"; then
    report_ok "command available: ${cmd_name}"
    return
  fi

  report_fixable "command not found: ${cmd_name}"
}

check_command docker
check_command kubectl
check_command k3d

while IFS= read -r repo_name; do
  if repo_exists "${repo_name}"; then
    report_ok "workspace repo present: ${repo_name}"
  else
    report_blocker "workspace repo missing: ${repo_name}"
  fi
done < <(required_workspace_repos)

if [[ -f "${ROOT_DIR}/env/local/.env.local" ]]; then
  report_ok "env file present: env/local/.env.local"
else
  report_fixable "env file missing: env/local/.env.local"
fi

if [[ -f "${ROOT_DIR}/env/local/.env.agent" ]]; then
  report_ok "agent env file present: env/local/.env.agent"
else
  report_fixable "agent env file missing: env/local/.env.agent"
fi

if [[ "${failures}" -eq 0 ]]; then
  ao_ok "Doctor passed. task local-up should be ready to run."
  exit 0
fi

if [[ "${installable_gaps}" -eq 1 ]]; then
  ao_step "Recommended next step: task install"
fi

exit 1
