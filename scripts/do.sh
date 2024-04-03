#!/bin/bash
# This script is an interface to any of the methods of lib.sh
# Call this script as "do.sh method_from_lib" to execute any function from that library
set -eu

command -v devenv >/dev/null 2>&1 || {
    echo '
Please install the devenv tool:
https://github.com/getsentry/devenv#install
'
    exit 1
}

HERE="$(
    cd "$(dirname "${BASH_SOURCE[0]}")"
    pwd -P
)"

[[ "$VIRTUAL_ENV" -ef "${HERE}/../.venv" ]] || {
    echo "
Your virtualenv isn't activated. You need to successfully run 'direnv allow'.
"
    exit 1
}

# shellcheck disable=SC1090
source "${HERE}/lib.sh"

"$@"
