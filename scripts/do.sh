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

# This guarantees that we're within a venv. A caller that is not within
# a venv can avoid enabling this by setting SENTRY_NO_VENV_CHECK
[ -z "${SENTRY_NO_VENV_CHECK+x}" ] && eval "${HERE}/ensure-venv.sh"
# If you call this script
start=`date +%s`
"$@"
end=`date +%s`
duration=$(($end-$start))

# If we're not in CI, send a metric of the script's execution time
if [ -z "${CI+x}" ]; then
    configure-sentry-cli
    # DSN for `sentry-devservices` project in the Sentry SDKs org. Used as authentication for sentry-cli.
    export SENTRY_DSN=https://8ae521d2441786bb405b3b3705bb9dc1@o447951.ingest.us.sentry.io/4507346183716864
    "${venv_name}"/bin/sentry-cli send-metric distribution -n script_execution_time -v $duration -u second -t script:$1
fi
