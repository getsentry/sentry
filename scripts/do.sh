#!/bin/bash
# This script is an interface to any of the methods of lib.sh
# Call this script as "do.sh method_from_lib" to execute any function from that library
set -eu

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")"; pwd -P)"
# shellcheck disable=SC1090
source "${HERE}/lib.sh"

# This block is to enable reporting issues to Sentry.io
if ! require sentry-cli; then
    curl -sL https://sentry.io/get-cli/ | bash
fi
# SENTRY_DSN already defined in .envrc
[ -n "${SENTRY_DSN+x}" ] && [ -z "${SENTRY_DEVENV_NO_REPORT+x}" ] && \
    eval "$(sentry-cli bash-hook)"

# If you call this script
"$@"
