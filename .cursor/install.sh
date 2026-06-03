#!/usr/bin/env bash
#
# Cloud-agent install/update script for Sentry.
#
# This is intended to be referenced from `.cursor/environment.json` (the
# `install` command) and run on every cloud-agent VM boot. It is idempotent:
# it only performs work that is missing and is safe to run repeatedly.
#
# It exists to work around two issues that otherwise make `devenv sync` fail
# on Linux cloud agents:
#
#   1. devenv/sync.py no longer manages `uv` (getsentry/sentry#107810). It now
#      requires `uv` to already be on PATH and hard-exits with code 1 if it is
#      missing. On macOS `uv` is installed via the Brewfile, but Linux cloud
#      agents have no Homebrew, so nothing installs it -> sync bails before any
#      dependency is installed.
#
#   2. Cursor configures a repo-local `core.hooksPath` for its agent hooks.
#      `prek install` (invoked by `devenv sync`) refuses to run while
#      `core.hooksPath` is set, failing the sync. We temporarily clear it for
#      the duration of the sync and restore it afterwards so Cursor's hooks
#      keep working.

set -euo pipefail

# devenv is bootstrapped into this location by the cloud-agent base image.
export PATH="$HOME/.local/share/sentry-devenv/bin:$PATH"

# --- Fix 1: ensure `uv` is available before `devenv sync` -------------------
if ! command -v uv >/dev/null 2>&1; then
  echo ">>> uv not found; installing via astral.sh installer"
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
# The astral installer drops uv into ~/.local/bin.
export PATH="$HOME/.local/bin:$PATH"
uv --version

# --- Fix 2: let `prek install` run despite Cursor's core.hooksPath ----------
PREV_HOOKS_PATH="$(git config --local --get core.hooksPath || true)"
restore_hooks_path() {
  if [ -n "${PREV_HOOKS_PATH}" ]; then
    git config --local core.hooksPath "${PREV_HOOKS_PATH}" || true
  fi
}
trap restore_hooks_path EXIT

if [ -n "${PREV_HOOKS_PATH}" ]; then
  echo ">>> temporarily unsetting core.hooksPath (${PREV_HOOKS_PATH}) for prek"
  git config --local --unset-all core.hooksPath || true
fi

# --- Run the real environment sync ------------------------------------------
devenv --nocoderoot sync
