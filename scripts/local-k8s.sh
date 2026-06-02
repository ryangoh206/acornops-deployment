#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/scripts/dev-bootstrap.sh"

local_k8s_apply_defaults() {
  : "${LOCAL_K8S_RUNTIME_DIR:=/tmp/acornops-local-kube}"
  : "${LOCAL_KUBECONFIG_PATH:=${LOCAL_K8S_RUNTIME_DIR}/config}"
  : "${LOCAL_K3D_CLUSTER_NAME:=acornops-demo-cluster}"
  : "${LOCAL_K3D_AUTO_CREATE:=true}"
}

local_k8s_init_runtime() {
  local_k8s_apply_defaults
  mkdir -p "${LOCAL_K8S_RUNTIME_DIR}"
}

local_k8s_rewrite_loopback_servers() {
  local kubeconfig_path="${1}"
  local rewritten_path="${kubeconfig_path}.rewritten"

  if [[ ! -f "${kubeconfig_path}" ]]; then
    return 1
  fi

  sed -E 's#https?://(0\.0\.0\.0|localhost):#https://127.0.0.1:#g' "${kubeconfig_path}" > "${rewritten_path}"
  mv "${rewritten_path}" "${kubeconfig_path}"
}

local_k8s_render_host_kubeconfig() {
  local output_path="${1}"
  local source_config="${KUBECONFIG:-$HOME/.kube/config}"

  if command -v kubectl >/dev/null 2>&1; then
    if kubectl config view --raw > "${output_path}" 2>/dev/null; then
      return 0
    fi
  fi

  if [[ "${source_config}" == *:* ]]; then
    return 1
  fi

  if [[ -f "${source_config}" ]]; then
    cp "${source_config}" "${output_path}"
    return 0
  fi

  return 1
}

local_k3d_cluster_exists() {
  local_k8s_apply_defaults

  if ! command -v k3d >/dev/null 2>&1; then
    return 1
  fi

  k3d cluster list 2>/dev/null | awk 'NR > 1 { print $1 }' | grep -Fxq "${LOCAL_K3D_CLUSTER_NAME}"
}

local_k3d_ensure_cluster() {
  local_k8s_apply_defaults

  if [[ "${LOCAL_K3D_AUTO_CREATE}" != "true" ]]; then
    return 0
  fi

  if local_k3d_cluster_exists; then
    ao_ok "Using existing local k3d cluster ${LOCAL_K3D_CLUSTER_NAME}."
    return 0
  fi

  if ! command -v k3d >/dev/null 2>&1; then
    ao_error "Missing dependency: k3d is required to create local cluster ${LOCAL_K3D_CLUSTER_NAME}."
    ao_note "Install k3d or set LOCAL_K3D_AUTO_CREATE=false to use an existing kubeconfig."
    exit 1
  fi

  ao_step "Creating local k3d cluster ${LOCAL_K3D_CLUSTER_NAME}..."
  k3d cluster create "${LOCAL_K3D_CLUSTER_NAME}" --no-lb --wait
  ao_ok "Local k3d cluster ${LOCAL_K3D_CLUSTER_NAME} is ready."
}

local_k8s_prepare_stack_kubeconfig() {
  local_k8s_apply_defaults
  local_k8s_init_runtime

  if local_k3d_cluster_exists; then
    k3d kubeconfig get "${LOCAL_K3D_CLUSTER_NAME}" > "${LOCAL_KUBECONFIG_PATH}"
    local_k8s_rewrite_loopback_servers "${LOCAL_KUBECONFIG_PATH}"
    return 0
  fi

  if local_k8s_render_host_kubeconfig "${LOCAL_KUBECONFIG_PATH}"; then
    local_k8s_rewrite_loopback_servers "${LOCAL_KUBECONFIG_PATH}"
    return 0
  fi

  rm -f "${LOCAL_KUBECONFIG_PATH}"
  return 1
}

local_k8s_kubectl() {
  local_k8s_apply_defaults

  if [[ -f "${LOCAL_KUBECONFIG_PATH}" ]]; then
    KUBECONFIG="${LOCAL_KUBECONFIG_PATH}" kubectl "$@"
    return
  fi

  kubectl "$@"
}
