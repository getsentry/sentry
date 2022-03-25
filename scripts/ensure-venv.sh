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

die() {
    cat <<EOF
$@
EOF
    exit 1
}

if [[ -n "$VIRTUAL_ENV" ]]; then
    # Let's make sure they know that they're not using a different version by mistake
    query-valid-python-version || exit 1
else
    if [[ ! -f "${venv_name}/bin/activate" ]]; then
        die "You don't seem to have a virtualenv. Please create one by running: source ./scripts/bootstrap-py3-venv"
    fi
    die "You have a virtualenv, but it doesn't seem to be activated. Please run: source ${venv_name}/bin/activate"
fi


if [ -L "${venv_name}/bin/python3" ] && [ ! -e "${venv_name}/bin/python3" ]; then
    die "Your symlink ${venv_name}/bin/python3 seems to be pointing to a non-existing Python binary. Try: rm -rf ${venv_name} && direnv allow"
fi


# Somehow it does not succeed unless I exit with 0
exit 0
