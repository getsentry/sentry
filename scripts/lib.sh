#!/bin/bash
# NOTE: This file is sourced in CI across different repos (e.g. snuba),
# thus, renaming this file or any functions can break CI!
#
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

# Check if a command is available
require() {
    command -v "$1" >/dev/null 2>&1
}

configure-sentry-cli() {
    if [ -z "${SENTRY_DEVENV_NO_REPORT+x}" ]; then
        if ! require sentry-cli; then
            curl -sL https://sentry.io/get-cli/ | SENTRY_CLI_VERSION=2.0.4 bash
        fi
    fi
}

query-valid-python-version() {
    python_version=$(python3 -V 2>&1 | awk '{print $2}')
    if [[ -n "${SENTRY_PYTHON_VERSION:-}" ]]; then
        if [ "$python_version" != "$SENTRY_PYTHON_VERSION" ]; then
            cat <<EOF
${red}${bold}
ERROR: You have explicitly set a non-recommended Python version (${SENTRY_PYTHON_VERSION}),
but it doesn't match the value of python's version: ${python_version}
You should create a new ${SENTRY_PYTHON_VERSION} virtualenv by running  "rm -rf ${venv_name} && direnv allow".
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
    fi
}

sudo-askpass() {
    if [ -z "${sudo-askpass-x}" ]; then
        sudo --askpass "$@"
    else
        sudo "$@"
    fi
}

pip-install() {
    pip install --constraint requirements-dev-frozen.txt "$@"
}

upgrade-pip() {
    pip-install pip setuptools wheel
}

install-py-dev() {
    upgrade-pip
    # It places us within top src dir to be at the same path as setup.py
    # This helps when getsentry calls into this script
    cd "${HERE}/.." || exit

    echo "--> Installing Sentry (for development)"

    # pip doesn't do well with swapping drop-ins
    pip uninstall -qqy uwsgi

    # SENTRY_LIGHT_BUILD=1 disables webpacking during setup.py.
    # Webpacked assets are only necessary for devserver (which does it lazily anyways)
    # and acceptance tests, which webpack automatically if run.
    SENTRY_LIGHT_BUILD=1 pip-install -e '.[dev]'
}

setup-git-config() {
    git config --local branch.autosetuprebase always
    git config --local core.ignorecase false
    git config --local blame.ignoreRevsFile .git-blame-ignore-revs
}

setup-git() {
    setup-git-config

    # if hooks are explicitly turned off do nothing
    if [[ "$(git config core.hooksPath)" == '/dev/null' ]]; then
        echo "--> core.hooksPath set to /dev/null. Skipping git hook setup"
        echo ""
        return
    fi

    echo "--> Installing git hooks"
    mkdir -p .git/hooks && cd .git/hooks && ln -sf ../../config/hooks/* ./ && cd - || exit
    # shellcheck disable=SC2016
    python3 -c '' || (
        echo 'Please run `make setup-pyenv` to install the required Python 3 version.'
        exit 1
    )
    if ! require pre-commit; then
        pip-install -r requirements-dev.txt
    fi
    pre-commit install --install-hooks
    echo ""
}

node-version-check() {
    # Checks to see if node's version matches the one specified in package.json for Volta.
    node -pe "process.exit(Number(!(process.version == 'v' + require('./package.json').volta.node )))" ||
        (
            echo 'Unexpected node version. Recommended to use https://github.com/volta-cli/volta'
            echo 'Run `volta install node` and `volta install yarn` to update your toolchain.'
            echo 'If you do not have volta installed run `curl https://get.volta.sh | bash` or visit https://volta.sh'
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
    install-js-dev
    install-py-dev
    setup-git
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
    echo "--> Creating a superuser account"
    if [[ -n "${GITHUB_ACTIONS+x}" ]]; then
        sentry createuser --superuser --email foo@tbd.com --no-password --no-input
    else
        sentry createuser --superuser
    fi
}

build-platform-assets() {
    echo "--> Building platform assets"
    echo "from sentry.utils.integrationdocs import sync_docs; sync_docs(quiet=True)" | sentry exec
    # make sure this didn't silently do nothing
    test -f src/sentry/integration-docs/android.json
}

bootstrap() {
    develop
    init-config
    run-dependent-services
    create-db
    apply-migrations
    create-user
    # Load mocks requires a super user to exist, thus, we execute after create-user
    bin/load-mocks
    build-platform-assets
    done-bootstraping
    echo "--> Finished bootstrapping. Have a nice day."
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
    create-user
    echo "Finished resetting database. To load mock data, run `./bin/load-mocks`"
}

prerequisites() {
    if [ -z "${CI+x}" ]; then
        brew update -q && brew bundle -q
    else
        HOMEBREW_NO_AUTO_UPDATE=on brew install pyenv
    fi
}

direnv-help() {
    cat >&2 <<EOF
If you're a Sentry employee and you're stuck or have questions, ask in #discuss-dev-infra.
If you're not, please file an issue under https://github.com/getsentry/sentry/issues/new/choose and mention @getsentry/owners-sentry-dev

You can configure the behaviour of direnv by adding the following variables to a .env file:

- SENTRY_DIRENV_DEBUG=1: This will allow printing debug messages
- SENTRY_DEVENV_NO_REPORT=1: Do not report development environment errors to Sentry.io
EOF
}
