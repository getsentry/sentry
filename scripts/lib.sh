#!/bin/bash
# NOTE: This file is sourced in CI across different repos (e.g. snuba),
# thus, renaming this file or any functions can break CI!
#
# Module containing code shared across various shell scripts
# Execute functions from this module via the script do.sh
# shellcheck disable=SC2034 # Unused variables
# shellcheck disable=SC2001 # https://github.com/koalaman/shellcheck/wiki/SC2001

POSTGRES_CONTAINER="sentry-postgres-1"
USE_OLD_DEVSERVICES=${USE_OLD_DEVSERVICES:-"0"}
if [ "$USE_OLD_DEVSERVICES" == "1" ]; then
    POSTGRES_CONTAINER="sentry_postgres"
fi

# This block is a safe-guard since in CI calling tput will fail and abort scripts
if [ -z "${CI+x}" ]; then
    bold="$(tput bold)"
    red="$(tput setaf 1)"
    green="$(tput setaf 2)"
    yellow="$(tput setaf 3)"
    reset="$(tput sgr0)"
fi

venv_name=".venv"

# XDG paths' standardized defaults:
# (see https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html#variables )
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
export XDG_DATA_DIRS="${XDG_DATA_DIRS:-/usr/local/share/:/usr/share/}"
export XDG_CONFIG_DIRS="${XDG_CONFIG_DIRS:-/etc/xdg}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/var/run}"


# Check if a command is available
require() {
    command -v "$1" >/dev/null 2>&1
}

query-valid-python-version() {
    python_version=$(python3 -V 2>&1 | awk '{print $2}')
    if [[ -n "${SENTRY_PYTHON_VERSION:-}" ]]; then
        if [ "$python_version" != "$SENTRY_PYTHON_VERSION" ]; then
            cat <<EOF
${red}${bold}
ERROR: You have explicitly set a non-recommended Python version (${SENTRY_PYTHON_VERSION}),
but it doesn't match the value of python's version: ${python_version}
You should create a new ${SENTRY_PYTHON_VERSION} virtualenv by running  "rm -rf ${venv_name} && devenv sync".
${reset}
EOF
            return 1
        else
            cat <<EOF
${yellow}${bold}
You have explicitly set a non-recommended Python version (${SENTRY_PYTHON_VERSION}). You're on your own.
${reset}
EOF
            return 0
        fi
    else
        minor=$(echo "${python_version}" | sed 's/[0-9]*\.\([0-9]*\)\.\([0-9]*\)/\1/')
        patch=$(echo "${python_version}" | sed 's/[0-9]*\.\([0-9]*\)\.\([0-9]*\)/\2/')
        if [ "$minor" -ne 12 ] || [ "$patch" -lt 1 ]; then
            cat <<EOF
    ${red}${bold}
    ERROR: You're running a virtualenv with Python ${python_version}.
    We only support >= 3.12.1, < 3.13.
    Either run "rm -rf ${venv_name} && direnv allow" to
    OR set SENTRY_PYTHON_VERSION=${python_version} to an .env file to bypass this check."
EOF
            return 1
        fi
    fi
}

sudo-askpass() {
    if [ -z "${sudo-askpass-x}" ]; then
        sudo --askpass "$@"
    else
        sudo "$@"
    fi
}

init-config() {
    sentry init --dev --no-clobber
}

run-dependent-services() {
    sentry devservices up
}

create-db() {
    container_name=${POSTGRES_CONTAINER}
    echo "--> Creating 'sentry' database"
    docker exec "${container_name}" createdb -h 127.0.0.1 -U postgres -E utf-8 sentry || true
    echo "--> Creating 'control', 'region' and 'secondary' database"
    docker exec "${container_name}" createdb -h 127.0.0.1 -U postgres -E utf-8 control || true
    docker exec "${container_name}" createdb -h 127.0.0.1 -U postgres -E utf-8 region || true
    docker exec "${container_name}" createdb -h 127.0.0.1 -U postgres -E utf-8 secondary || true
}

apply-migrations() {
    create-db
    echo "--> Applying migrations"
    sentry upgrade --noinput
}

create-superuser() {
    echo "--> Creating a superuser account"
    if [[ -n "${GITHUB_ACTIONS+x}" ]]; then
        sentry createuser --superuser --email foo@tbd.com --no-password --no-input
    else
        sentry createuser --superuser --email admin@sentry.io --password admin --no-input
        echo "Password is admin."
    fi
}

build-platform-assets() {
    echo "--> Building platform assets"
    python3 -m sentry.build._integration_docs
    # make sure this didn't silently do nothing
    test -f src/sentry/integration-docs/android.json
}

clean() {
    echo "--> Cleaning static cache"
    rm -rf dist/* src/sentry/static/sentry/dist/*
    echo "--> Cleaning integration docs cache"
    rm -rf src/sentry/integration-docs
    echo "--> Cleaning pyc files"
    find . -name "*.pyc" -delete
    echo "--> Cleaning python build artifacts"
    rm -rf build/ dist/ src/sentry/assets.json
    echo ""
}

drop-db() {
    container_name=${POSTGRES_CONTAINER}
    echo "--> Dropping existing 'sentry' database"
    docker exec "${container_name}" dropdb --if-exists -h 127.0.0.1 -U postgres sentry
    echo "--> Dropping 'control' and 'region' database"
    docker exec "${container_name}" dropdb --if-exists -h 127.0.0.1 -U postgres control
    docker exec "${container_name}" dropdb --if-exists -h 127.0.0.1 -U postgres region
    docker exec "${container_name}" dropdb --if-exists -h 127.0.0.1 -U postgres secondary
}

reset-db() {
    drop-db
    apply-migrations
    create-superuser
    echo 'Finished resetting database. To load mock data, run `./bin/load-mocks`'
}
