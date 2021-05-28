#!/bin/bash
# Module containing code shared across various shell scripts
# Execute functions from this module via the script do.sh

# Check if a command is available
require() {
    command -v "$1" >/dev/null 2>&1
}

configure-sentry-cli() {
    if [ -n "${SENTRY_DSN+x}" ] && [ -z "${SENTRY_DEVENV_NO_REPORT+x}" ]; then
        if ! require sentry-cli; then
            curl -sL https://sentry.io/get-cli/ | bash
        fi
        eval "$(sentry-cli bash-hook)"
    fi
}

query_big_sur() {
    if require sw_vers && sw_vers -productVersion | grep -E "11\." >/dev/null; then
        return 0
    fi
    return 1
}

upgrade-pip() {
    # pip versions before 20.1 do not have `pip cache` as a command which is necessary for the CI
    pip install --no-cache-dir --upgrade "pip>=20.1"
    # The Python version installed via pyenv does not come with wheel pre-installed
    # Installing wheel will speed up installation of Python dependencies
    require wheel || pip install wheel
}

install-py-dev() {
    upgrade-pip
    # It places us within top src dir to be at the same path as setup.py
    # This helps when getsentry calls into this script
    cd "${HERE}/.." || exit
    echo "--> Installing Sentry (for development)"
    # In Big Sur, versions of pip before 20.3 require SYSTEM_VERSION_COMPAT set
    if query_big_sur && python -c 'from sys import exit; import pip; from pip._vendor.packaging.version import parse; exit(1 if parse(pip.__version__) < parse("20.3") else 0)'; then
        SENTRY_LIGHT_BUILD=1 SYSTEM_VERSION_COMPAT=1 pip install -e '.[dev]'
    else
        # SENTRY_LIGHT_BUILD=1 disables webpacking during setup.py.
        # Webpacked assets are only necessary for devserver (which does it lazily anyways)
        # and acceptance tests, which webpack automatically if run.
        SENTRY_LIGHT_BUILD=1 pip install -e '.[dev]'
    fi
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
    # shellcheck disable=SC2155
    local CREATEDB=$(command -v createdb 2>/dev/null)
    if [[ -z "$CREATEDB" ]]; then
        CREATEDB="docker exec sentry_postgres createdb"
    fi
    echo "--> Creating 'sentry' database"
    ${CREATEDB} -h 127.0.0.1 -U postgres -E utf-8 sentry || true
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
    # shellcheck disable=SC2155
    local DROPDB=$(command -v dropdb 2>/dev/null)
    if [[ -z "$DROPDB" ]]; then
        DROPDB="docker exec sentry_postgres dropdb"
    fi
    echo "--> Dropping existing 'sentry' database"
    ${DROPDB} -h 127.0.0.1 -U postgres sentry || true
}

reset-db() {
    drop-db
    create-db
    apply-migrations
}

direnv-help() {
    cat >&2 <<EOF
If you're a Sentry employee and you're stuck or have questions, ask in #discuss-dev-tooling.
If you're not, please file an issue under https://github.com/getsentry/sentry/issues/new/ and mention @getsentry/owners-sentry-dev

You can configure the behaviour of direnv by adding the following variables to a .env file:

- SENTRY_DIRENV_DEBUG=1: This will allow printing debug messages
- SENTRY_DEVENV_NO_REPORT=1: Do not report development environment errors to Sentry.io
EOF
}
