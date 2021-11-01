#!/bin/bash
# Module containing code shared across various shell scripts
# Execute functions from this module via the script do.sh
# shellcheck disable=SC2034 # Unused variables
# shellcheck disable=SC2001 # https://github.com/koalaman/shellcheck/wiki/SC2001

# This block is a safe-guard since in CI calling tput will fail and abort scripts
if [ -z "${CI+x}" ]; then
    bold="$(tput bold)"
    red="$(tput setaf 1)"
    green="$(tput setaf 2)"
    yellow="$(tput setaf 3)"
    reset="$(tput sgr0)"
fi

venv_name=".venv"

# NOTE: This file is sourced in CI across different repos (e.g. snuba),
# so renaming this file or any functions can break CI!

# Check if a command is available
require() {
    command -v "$1" >/dev/null 2>&1
}

configure-sentry-cli() {
    # XXX: For version 1.70.1 there's a bug hitting SENTRY_CLI_NO_EXIT_TRAP: unbound variable
    # We can remove this after it's fixed
    # https://github.com/getsentry/sentry-cli/pull/1059
    export SENTRY_CLI_NO_EXIT_TRAP=${SENTRY_CLI_NO_EXIT_TRAP-0}
    if [ -n "${SENTRY_DSN+x}" ] && [ -z "${SENTRY_DEVENV_NO_REPORT+x}" ]; then
        if ! require sentry-cli; then
            curl -sL https://sentry.io/get-cli/ | bash
        fi
        eval "$(sentry-cli bash-hook)"
    fi
}

query-mac() {
    [[ $(uname -s) = 'Darwin' ]]
}

query-big-sur() {
    if require sw_vers && sw_vers -productVersion | grep -E "11\." >/dev/null; then
        return 0
    fi
    return 1
}

query-apple-m1() {
    query-mac && [[ $(uname -m) = 'arm64' ]]
}

query-valid-python-version() {
    if [[ -n "${SENTRY_PYTHON_VERSION:-}" ]]; then
        python_version=$(python3 -V 2>&1 | awk '{print $2}')
        if [ "$python_version" != "$SENTRY_PYTHON_VERSION" ]; then
            cat <<EOF
${red}${bold}
ERROR: You have explicitly set a non-recommended Python version (${SENTRY_PYTHON_VERSION}),
but it doesn't match the value of python's version: ${python_version}
You should create a new ${SENTRY_PYTHON_VERSION} virtualenv by running  "rm -rf ${venv_name} && direnv allow".
${reset}
EOF
            return 1
        fi

        cat <<EOF
${yellow}${bold}
You have explicitly set a non-recommended Python version (${SENTRY_PYTHON_VERSION}). You're on your own.
${reset}
EOF
        return 0
    fi

    python_version=$(python3 -V 2>&1 | awk '{print $2}')
    minor=$(echo "${python_version}" | sed 's/[0-9]*\.\([0-9]*\)\.\([0-9]*\)/\1/')
    patch=$(echo "${python_version}" | sed 's/[0-9]*\.\([0-9]*\)\.\([0-9]*\)/\2/')

    if [ "$minor" -ne 8 ] || [ "$patch" -lt 10 ]; then
        cat <<EOF
${red}${bold}
ERROR: You're running a virtualenv with Python ${python_version}.
We only support >= 3.8.10, < 3.9.
Either run "rm -rf ${venv_name} && direnv allow" to
OR set SENTRY_PYTHON_VERSION=${python_version} to an .env file to bypass this check."
EOF
        return 1
    fi
}

sudo-askpass() {
    if [ -z "${sudo-askpass-x}" ]; then
        sudo --askpass "$@"
    else
        sudo "$@"
    fi
}

upgrade-pip() {
    pip install --upgrade "pip==21.1.2" "wheel==0.36.2"
}

install-py-dev() {
    upgrade-pip
    # It places us within top src dir to be at the same path as setup.py
    # This helps when getsentry calls into this script
    cd "${HERE}/.." || exit
    echo "--> Installing Sentry (for development)"
    if query-apple-m1; then
        # This installs pyscopg-binary2 since there's no arm64 wheel
        # This saves having to install postgresql on the Developer's machine + using flags
        # https://github.com/psycopg/psycopg2/issues/1286
        pip install https://storage.googleapis.com/python-arm64-wheels/psycopg2_binary-2.8.6-cp38-cp38-macosx_11_0_arm64.whl
        # This install confluent-kafka from our GC storage since there's no arm64 wheel
        # https://github.com/confluentinc/confluent-kafka-python/issues/1190
        pip install https://storage.googleapis.com/python-arm64-wheels/confluent_kafka-1.5.0-cp38-cp38-macosx_11_0_arm64.whl
    fi
    # SENTRY_LIGHT_BUILD=1 disables webpacking during setup.py.
    # Webpacked assets are only necessary for devserver (which does it lazily anyways)
    # and acceptance tests, which webpack automatically if run.
    SENTRY_LIGHT_BUILD=1 pip install -e '.[dev]'
}

setup-git-config() {
    git config --local branch.autosetuprebase always
    git config --local core.ignorecase false
    git config --local blame.ignoreRevsFile .git-blame-ignore-revs
}

setup-git() {
    setup-git-config
    echo "--> Installing git hooks"
    mkdir -p .git/hooks && cd .git/hooks && ln -sf ../../config/hooks/* ./ && cd - || exit
    # shellcheck disable=SC2016
    python3 -c '' || (
        echo 'Please run `make setup-pyenv` to install the required Python 3 version.'
        exit 1
    )
    pip install -r requirements-pre-commit.txt
    pre-commit install --install-hooks
    echo ""
}

node-version-check() {
    # Checks to see if node's version matches the one specified in package.json for Volta.
    node -pe "process.exit(Number(!(process.version == 'v' + require('./package.json').volta.node )))" ||
        (
            echo 'Unexpected node version. Recommended to use https://github.com/volta-cli/volta'
            exit 1
        )
}

install-js-dev() {
    node-version-check
    echo "--> Installing Yarn packages (for development)"
    # Use NODE_ENV=development so that yarn installs both dependencies + devDependencies
    NODE_ENV=development yarn install --frozen-lockfile
    # A common problem is with node packages not existing in `node_modules` even though `yarn install`
    # says everything is up to date. Even though `yarn install` is run already, it doesn't take into
    # account the state of the current filesystem (it only checks .yarn-integrity).
    # Add an additional check against `node_modules`
    yarn check --verify-tree || yarn install --check-files
}

develop() {
    setup-git
    install-js-dev
    install-py-dev
}

init-config() {
    sentry init --dev
}

run-dependent-services() {
    sentry devservices up
}

create-db() {
    echo "--> Creating 'sentry' database"
    docker exec sentry_postgres createdb -h 127.0.0.1 -U postgres -E utf-8 sentry || true
}

apply-migrations() {
    echo "--> Applying migrations"
    sentry upgrade --noinput
}

create-user() {
    if [[ -n "${GITHUB_ACTIONS+x}" ]]; then
        sentry createuser --superuser --email foo@tbd.com --no-password
    else
        sentry createuser --superuser
    fi
}

build-platform-assets() {
    echo "--> Building platform assets"
    echo "from sentry.utils.integrationdocs import sync_docs; sync_docs(quiet=True)" | sentry exec
}

bootstrap() {
    develop
    init-config
    run-dependent-services
    create-db
    apply-migrations
    create-user
    build-platform-assets
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
    echo "--> Dropping existing 'sentry' database"
    docker exec sentry_postgres dropdb -h 127.0.0.1 -U postgres sentry || true
}

reset-db() {
    drop-db
    create-db
    apply-migrations
}

prerequisites() {
    if [ -z "${CI+x}" ]; then
        brew update -q && brew bundle -q
    else
        HOMEBREW_NO_AUTO_UPDATE=on brew install libxmlsec1 pyenv
    fi
}

direnv-help() {
    cat >&2 <<EOF
If you're a Sentry employee and you're stuck or have questions, ask in #discuss-dev-tooling.
If you're not, please file an issue under https://github.com/getsentry/sentry/issues/new/choose and mention @getsentry/owners-sentry-dev

You can configure the behaviour of direnv by adding the following variables to a .env file:

- SENTRY_DIRENV_DEBUG=1: This will allow printing debug messages
- SENTRY_DEVENV_NO_REPORT=1: Do not report development environment errors to Sentry.io
EOF
}
