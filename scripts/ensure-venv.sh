#!/bin/bash

# optionally opt out of virtualenv creation
# WARNING: this will be removed (most likely renamed) soon!
if [ "x$SENTRY_NO_VIRTUALENV_CREATION" == "x1" ]; then
    exit 0
fi

if [ -n "$VIRTUAL_ENV" ]; then
    # we're enforcing that virtualenv be in .venv, since future tooling e.g. venv-update will rely on this.
    if [ "$VIRTUAL_ENV" != "${PWD}/.venv" ]; then
        echo "You're in a virtualenv, but it's not in the expected location (${PWD}/.venv)"
        exit 1
    fi
    # TODO: when direnv lands, make the check strictly match .python-version.
    if ! python -c "import sys; sys.exit(sys.version_info[:2] != (2, 7))"; then
        echo "Your virtualenv's python version isn't 2.7. You'll need to recreate it with the correct python version."
        exit 1
    fi
else
    if [ ! -f ".venv/bin/activate" ]; then
        echo "You don't seem to have a virtualenv. Please create one by running: python -m virtualenv .venv"
        exit 1
    fi
    echo "You have a virtualenv, but it doesn't seem to be activated. Please run: source .venv/bin/activate"
    exit 1
fi
