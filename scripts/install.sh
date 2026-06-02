#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/scripts/dev-bootstrap.sh"

install_with_brew() {
  local package_name="$1"
  brew install "${package_name}"
}

install_cask_with_brew() {
  local package_name="$1"
  brew install --cask "${package_name}"
}

install_os() {
  printf '%s\n' "${AO_INSTALL_OS:-$(uname -s)}"
}

is_dry_run() {
  [[ "${AO_INSTALL_DRY_RUN:-0}" == "1" ]]
}

run_command() {
  if is_dry_run; then
    ao_step "Would run: $*"
    return 0
  fi

  "$@"
}

run_shell() {
  local command="$1"
  if is_dry_run; then
    ao_step "Would run: ${command}"
    return 0
  fi

  bash -c "${command}"
}

run_privileged() {
  if [[ "${EUID}" -eq 0 ]]; then
    run_command "$@"
    return
  fi

  if ! command_exists sudo; then
    ao_error "sudo is required to install packages on Linux."
    exit 1
  fi

  run_command sudo "$@"
}

should_install_command() {
  local command_name="$1"
  if [[ "${AO_INSTALL_FORCE:-0}" == "1" ]]; then
    return 0
  fi

  ! command_exists "${command_name}"
}

ensure_brew_available() {
  if command_exists brew; then
    return 0
  fi

  ao_error "Homebrew is required for automated installs on $(install_os)."
  ao_note "Install Homebrew, then rerun task install."
  exit 1
}

detect_linux_package_manager() {
  if [[ -n "${AO_LINUX_PACKAGE_MANAGER:-}" ]]; then
    printf '%s\n' "${AO_LINUX_PACKAGE_MANAGER}"
    return
  fi

  for package_manager in apt-get dnf yum pacman zypper; do
    if command_exists "${package_manager}"; then
      printf '%s\n' "${package_manager}"
      return
    fi
  done

  ao_error "Unsupported Linux distribution: no supported package manager found."
  ao_note "Install docker, kubectl, and k3d manually, then rerun task doctor."
  exit 1
}

linux_arch() {
  case "$(uname -m)" in
    x86_64 | amd64)
      printf '%s\n' "amd64"
      ;;
    aarch64 | arm64)
      printf '%s\n' "arm64"
      ;;
    *)
      ao_error "Unsupported Linux architecture: $(uname -m)"
      exit 1
      ;;
  esac
}

install_docker_with_linux_package_manager() {
  local package_manager="$1"

  case "${package_manager}" in
    apt-get)
      run_privileged apt-get update
      run_privileged apt-get install -y docker.io docker-compose-plugin
      ;;
    dnf)
      run_privileged dnf install -y docker docker-compose-plugin
      ;;
    yum)
      run_privileged yum install -y docker docker-compose-plugin
      ;;
    pacman)
      run_privileged pacman -Sy --needed --noconfirm docker docker-compose
      ;;
    zypper)
      run_privileged zypper --non-interactive install docker docker-compose
      ;;
    *)
      ao_error "Unsupported Linux package manager: ${package_manager}"
      exit 1
      ;;
  esac

  if command_exists systemctl; then
    run_privileged systemctl enable --now docker
  fi
}

install_linux_package() {
  local package_manager="$1"
  shift

  case "${package_manager}" in
    apt-get)
      run_privileged apt-get install -y "$@"
      ;;
    dnf)
      run_privileged dnf install -y "$@"
      ;;
    yum)
      run_privileged yum install -y "$@"
      ;;
    pacman)
      run_privileged pacman -Sy --needed --noconfirm "$@"
      ;;
    zypper)
      run_privileged zypper --non-interactive install "$@"
      ;;
    *)
      ao_error "Unsupported Linux package manager: ${package_manager}"
      exit 1
      ;;
  esac
}

ensure_linux_download_tools() {
  local package_manager="$1"

  if should_install_command curl; then
    ao_step "Installing curl..."
    install_linux_package "${package_manager}" curl
  fi
}

install_kubectl_linux() {
  local arch
  local version
  local kubectl_tmp

  arch="$(linux_arch)"
  version="stable"
  kubectl_tmp="${TMPDIR:-/tmp}/kubectl"

  if ! is_dry_run; then
    version="$(curl -fsSL https://dl.k8s.io/release/stable.txt)"
  fi

  run_command curl -fsSL "https://dl.k8s.io/release/${version}/bin/linux/${arch}/kubectl" -o "${kubectl_tmp}"
  run_command chmod +x "${kubectl_tmp}"
  run_privileged install -m 0755 "${kubectl_tmp}" /usr/local/bin/kubectl
}

install_required_commands_linux() {
  local package_manager

  package_manager="$(detect_linux_package_manager)"

  ensure_linux_download_tools "${package_manager}"

  if should_install_command docker; then
    ao_step "Installing Docker Engine..."
    install_docker_with_linux_package_manager "${package_manager}"
  fi

  if should_install_command kubectl; then
    ao_step "Installing kubectl..."
    install_kubectl_linux
  fi

  if should_install_command k3d; then
    ao_step "Installing k3d..."
    run_shell "curl -fsSL https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash"
  fi
}

install_required_commands() {
  case "$(install_os)" in
    Darwin)
      ensure_brew_available

      if should_install_command docker; then
        ao_step "Installing Docker Desktop..."
        install_cask_with_brew docker
      fi

      if should_install_command kubectl; then
        ao_step "Installing kubectl..."
        install_with_brew kubectl
      fi

      if should_install_command k3d; then
        ao_step "Installing k3d..."
        install_with_brew k3d
      fi
      ;;
    Linux)
      install_required_commands_linux
      ;;
    *)
      ao_error "Unsupported OS: $(install_os)"
      exit 1
      ;;
  esac
}

ao_heading "Installing AcornOps local-up prerequisites..."
install_required_commands

if is_dry_run; then
  ao_note "Skipping env file bootstrap."
else
  ensure_env_file "${ROOT_DIR}/env/local/.env.local" "${ROOT_DIR}/env/local/.env.example"
  ensure_env_file "${ROOT_DIR}/env/local/.env.agent" "${ROOT_DIR}/env/local/.env.agent.example"
fi

ao_heading "Validating installation..."
if [[ "${AO_INSTALL_SKIP_DOCTOR:-0}" == "1" ]]; then
  ao_note "Skipping doctor validation."
else
  "${ROOT_DIR}/scripts/doctor.sh"
fi
