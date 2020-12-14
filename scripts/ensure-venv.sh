#!/bin/bash

# optionally opt out of virtualenv creation
# WARNING: this will be removed (most likely renamed) soon!
if [[ "$SENTRY_NO_VIRTUALENV_CREATION" == "1" ]]; then
    exit 0
fi

yellow="$(tput setaf 3)"
bold="$(tput bold)"
reset="$(tput sgr0)"

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
    major=`python -c "import sys; print(sys.version_info[0])"`
    minor=`python -c "import sys; print(sys.version_info[1])"`
    # If .venv contains Python2 or SENTRY_PYTHON2 is set, then fail with instructions
    if [[ "$major" -eq 2 ]] || [[ ! -z "$SENTRY_PYTHON2" ]]; then
        cat << EOF
${yellow}${bold}
WARNING! You are running a Python 2 virtualenv, which is DEPRECATED.
Support will be dropped beginning in 2021.
${reset}
EOF
    else
        # If .venv is less than Python 3.6 fail
        [[ "$minor" -lt 6 ]] &&
            die "Remove $VIRTUAL_ENV and try again since the Python version installed should be at least 3.6."
    fi
else
    if [[ ! -f "${venv_name}/bin/activate" ]]; then
        die "You don't seem to have a virtualenv. Please create one by running: python${python_version} -m virtualenv ${venv_name}"
    fi
    die "You have a virtualenv, but it doesn't seem to be activated. Please run: source ${venv_name}/bin/activate"
fi

# Somehow it does not succeed unless I exit with 0
exit 0
