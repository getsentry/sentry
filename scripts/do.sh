#!/bin/bash
# This script is an interface to any of the methods of lib.sh
# Call this script as "do.sh method_from_lib" to execute any function from that library
set -eu

HERE="$(
    cd "$(dirname "${BASH_SOURCE[0]}")"
    pwd -P
)"

if ! command -v devenv >/dev/null 2>&1; then
    echo '
Please install the devenv tool:
https://github.com/getsentry/devenv#install
'
    exit 1
fi

if ! [[ "$VIRTUAL_ENV" -ef "${HERE}/../.venv" ]]; then
    echo "
Your sentry virtualenv isn't activated. You need to successfully run 'direnv allow'.
"
    exit 1
fi

# shellcheck disable=SC1090
source "${HERE}/lib.sh"

"$@"
