#!/bin/bash
# Module containing code shared across various shell scripts

# Check if a command is available
require() {
    command -v "$1" >/dev/null 2>&1
}

query_big_sur() {
    if require sw_vers && sw_vers -productVersion | grep -E "11\." > /dev/null; then
        return 0
    fi
    return 1
}

if ! require sentry-cli; then
    curl -sL https://sentry.io/get-cli/ | bash
fi
# SENTRY_DSN already defined in .envrc
[ -n "${SENTRY_DSN+x}" ] && [ -z "${SENTRY_DEVENV_NO_REPORT+x}" ] && \
    eval "$(sentry-cli bash-hook)"
