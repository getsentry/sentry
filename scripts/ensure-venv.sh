#!/bin/bash

# optionally opt out of virtualenv creation
# WARNING: this will be removed (most likely renamed) soon!
if [ "$SENTRY_NO_VIRTUALENV_CREATION" == "1" ]; then
    exit 0
fi

venv_name=".venv"
python_bin="python2.7"

if [ "$SENTRY_PYTHON3" = "1" ]; then
    venv_name=".venv3"
    python_bin="python3.6"
fi

die() {
    cat >&2 "${@}"
    exit 1
}

if [ -n "$VIRTUAL_ENV" ]; then
    # we're enforcing that virtualenv be in .venv, since future tooling e.g. venv-update will rely on this.
    if [ "$VIRTUAL_ENV" != "${PWD}/${venv_name}" ]; then
        die "You're in a virtualenv, but it's not in the expected location (${PWD}/${venv_name})"
    fi

    # TODO: Update this to strictly check .python-version
    if [ "$SENTRY_PYTHON3" = "1" ]; then
        python -c "import sys; sys.exit(sys.version_info[:2] != (3, 6))" ||
            die "For some reason, the virtualenv isn't Python 3.6."
    else
        python -c "import sys; sys.exit(sys.version_info[:2] != (2, 7))" ||
            die "For some reason, the virtualenv isn't Python 2.7."
    fi
else
    if [ ! -f "${venv_name}/bin/activate" ]; then
        die "You don't seem to have a virtualenv. Please create one by running: ${python_bin} -m virtualenv ${venv_name}"
    fi
    die "You have a virtualenv, but it doesn't seem to be activated. Please run: source ${venv_name}/bin/activate"
fi
