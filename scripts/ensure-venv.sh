#!/bin/bash
HERE="$(
    cd "$(dirname "${BASH_SOURCE[0]}")" || exit
    pwd -P
)"
# shellcheck disable=SC1090
source "${HERE}/lib.sh"

# optionally opt out of virtualenv creation
# WARNING: this will be removed (most likely renamed) soon!
if [[ "$SENTRY_NO_VIRTUALENV_CREATION" == "1" ]]; then
    exit 0
fi

venv_name=".venv"

die() {
    cat <<EOF
$@
EOF
    exit 1
}

if [[ -n "$VIRTUAL_ENV" ]]; then
    # The developer is inside is inside a virtualenv *and* has set a SENTRY_PYTHON_VERSION
    # Let's assume that they know what they're doing
    if [[ -n "$SENTRY_PYTHON_VERSION" ]]; then
        cat <<EOF
${yellow}${bold}
You have explicitly set a non-recommended Python version ($(python -V | awk '{print $2}')). You're on your own.
${reset}
EOF
        exit 0
    fi

    # Let's make sure they know that they're not using a different version by mistake

    if ! query-valid-python-versions; then
        cat <<EOF
    ${yellow}${bold}
    WARNING! You are running a virtualenv with a Python version ($(which python))
    different than 3.6.13 or 3.8.10. We recommend you start with a fresh virtualenv OR"
    use SENTRY_PYTHON_VERSION to by-pass this check.
    ${reset}
EOF
    fi
else
    if [[ ! -f "${venv_name}/bin/activate" ]]; then
        die "You don't seem to have a virtualenv. Please create one by running: python3.6 -m venv ${venv_name}"
    fi
    die "You have a virtualenv, but it doesn't seem to be activated. Please run: source ${venv_name}/bin/activate"
fi

# Somehow it does not succeed unless I exit with 0
exit 0
