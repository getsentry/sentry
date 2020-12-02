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
    python -V | sed 's/\./ /g' | read _ python_major python_minor
    # If .venv contains Python2 and no SENTRY_PYTHON2 is set, then fail with instructions
    if [[ "$python_major" -eq 2 ]]; then
        [[ -n "$SENTRY_PYTHON2" ]] ||
            die \
            "To set up Python 3, run the following: source ./scripts/bootstrap-py3-venv" \
            "To keep using Python 2, run: source ./scripts/bootstrap-py2-venv"
    else
        # If .venv is less than Python 3.6 fail
        [[ "$python_major" != 3 || "$python_minor" < 6 ]] ||
            die "Remove $VIRTUAL_ENV and try again since the Python version installed should be at least 3.6."
    fi
else
    if [[ ! -f "${venv_name}/bin/activate" ]]; then
        die "You don't seem to have a virtualenv. Please create one by running: python${python_version} -m virtualenv ${venv_name}"
    fi
    die "You have a virtualenv, but it doesn't seem to be activated. Please run: source ${venv_name}/bin/activate"
fi
