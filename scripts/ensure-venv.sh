#!/bin/bash

# optionally opt out of virtualenv creation
# WARNING: this will be removed (most likely renamed) soon!
if [[ "$SENTRY_NO_VIRTUALENV_CREATION" == "1" ]]; then
    exit 0
fi

venv_name=".venv"
python_version="3.6"

if [[ "$SENTRY_PYTHON2" = "1" ]]; then
    venv_name=".venv2"
    python_version="2.7"
fi

die () {
    cat <<EOF
$@
EOF
    exit 1
}

if [[ -n "$VIRTUAL_ENV" ]]; then
    if [[ "$VIRTUAL_ENV" != "${PWD}/${venv_name}" ]]; then
        die "You're in a virtualenv, but it's not in the expected location (${PWD}/${venv_name})"
    fi

    if [[ "$(python -V 2>&1)" != "Python $(grep ${python_version} .python-version)" ]]; then
        die "For some reason, the virtualenv isn't Python ${python_version}."
    fi
else
    if [[ ! -f "${venv_name}/bin/activate" ]]; then
        die "You don't seem to have a virtualenv. Please create one by running: python${python_version} -m virtualenv ${venv_name}"
    fi
    die "You have a virtualenv, but it doesn't seem to be activated. Please run: source ${venv_name}/bin/activate"
fi
