#!/bin/bash
# This script installs sentry-cli if not available and
set -eu

# Check if a command is available
require() {
    command -v "$1" >/dev/null 2>&1
}

setup_sentry-cli() {
  if ! require sentry-cli; then
    curl -sL https://sentry.io/get-cli/ | bash
    eval "$(sentry-cli bash-hook)"
  fi
  # We need to get this
  export SENTRY_DSN=https://23670f54c6254bfd9b7de106637808e9@o1.ingest.sentry.io/1492057
  root_dir=$(git rev-parse --show-toplevel)
}

setup_sentry-cli
