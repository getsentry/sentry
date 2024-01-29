#!/bin/bash
# This script is an interface to any of the methods of lib.sh
# Call this script as "do.sh method_from_lib" to execute any function from that library
set -eu
HERE="$(
    cd "$(dirname "${BASH_SOURCE[0]}")"
    pwd -P
)"
# shellcheck disable=SC1090
source "${HERE}/lib.sh"

# This block is to enable reporting issues to Sentry.io
# SENTRY_DSN already defined in .envrc
configure-sentry-cli

# This guarantees that we're within a venv. A caller that is not within
# a venv can avoid enabling this by setting SENTRY_NO_VENV_CHECK
[ -z "${SENTRY_NO_VENV_CHECK+x}" ] && eval "${HERE}/ensure-venv.sh"
# If you call this script
"$@"
