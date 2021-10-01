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

# NOTE: This file is sourced in CI across different repos (e.g. snuba),
# so renaming this file or any functions can break CI!

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

get-pyenv-version() {
    local PYENV_VERSION
    PYENV_VERSION=3.6.13
    if query-apple-m1; then
        PYENV_VERSION=3.8.11
    fi
    echo "${PYENV_VERSION}"
}

query-valid-python-version() {
    python_version=$(python3 -V 2>&1 | awk '{print $2}')
    minor=$(echo "${python_version}" | sed 's/[0-9]*\.\([0-9]*\)\.\([0-9]*\)/\1/')
    patch=$(echo "${python_version}" | sed 's/[0-9]*\.\([0-9]*\)\.\([0-9]*\)/\2/')

    # For Apple M1, we only allow 3.8 and at least patch version 10
    if query-apple-m1; then
        if [ "$minor" -ne 8 ] || [ "$patch" -lt 10 ]; then
            return 1
        fi
    # For everything else, we only allow 3.6
    elif [ "$minor" -ne 6 ]; then
        return 1
    fi
    return 0
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
        pip install "https://00f74ba44b452e1c23899a4da635741177076521a3-apidata.googleusercontent.com/download/storage/v1/b/python-arm64-wheels/o/psycopg2_binary-2.8.6-cp38-cp38-macosx_11_0_arm64.whl?jk=AFshE3Vt2Xe9K9fArum71YgGqh0FgN35Vgk22IWH9HUhpCctxi4wU1pT1M1WAHQ45P7fAkyKyzwSc1emL9RduXFqmKcu4oSLYsVG5WQCuWMXreMwYTsJpe1XMFVEK5cDkz80qtUTI-IlpSGXSQ6ZSxL_3pDhCZynw0cdfOQv6Ei9lHiZSCD-D06jg8IBvYssAh6hhdtuDQY8VoUQSO-i_fdb6-tYkw1Vjf5c1E2OhcYntjUawORukrjVbPlrU4QVRWwT3Hr62ZTH8D6qzvbTG6isE6oNOlIlkSvmoqVmNpn3U4zDYuNUI5G62wP1QC-6_uKe9vpZ75mQwsaJuOp3104UZi6ApZgLsmQRHhEr06Avzzh0rQpk3aENPiol8Yn-kAn1R8Vh4MHzVVbIltM5Fk9qb_ivGw9dSIAjHOcn0RXHwbd_R7oKucgAGHrCbmL1BxuZUzU58UFDA6tLuFgNVX316uZ-e2-euzd5-RQ3LAQxvkt6h0AHCXIa7Gqk4VUiT2EQ_dRYddmmDS2vARFUwS8bgMQcADTercuW9VoqjtpmI9DiOapBKqW3R7EeUmY2Xg24_lN5CsmAAnzU_tvhC6plCP34RZhRodZeEzCA_y6SgXkqqBLjYOfY4l6SOSMF_bq4xGS0B-XlWRpiH22SFGI846rPLOklaNT2u0Pu-ae15H0-RoY_OwlcfJ6zEIrk4mRzeToEnrAv0a6BTUN8ffsQapXg0TptFXTbnM3LNSTu1zL6pchCj3YEYO1wJgKu98Qz_nWEa043F4f0WnQ-SVI2m1OsHzeEwX1tt4ZjQ9FUw5RBKxjbeKvchE5Ni7IeUsfTV4ixVxsbf992CbwXfPEyzYYADNr5a3N08uLPWV_H-gI8mo-8h0qE6dTef4t_MFuB9QJkOSn8oed9_rl-hNxa1Exd6KCTBqTJ5KlgWUDJLpcmx8W4ZfkzHva7kDwH4ej6ES3-_SNK9yPCccSYXbBFzW8SciWgxXjZQzImflZ-fA4VclZ4_s1bF3YdN09aSPY1&isca=1"
        # This install confluent-kafka from our GC storage since there's no arm64 wheel
        # https://github.com/confluentinc/confluent-kafka-python/issues/1190
        pip install "https://00f74ba44b4a2a78e0580edf350645358065c4e215-apidata.googleusercontent.com/download/storage/v1/b/python-arm64-wheels/o/confluent_kafka-1.5.0-cp38-cp38-macosx_11_0_arm64.whl?jk=AFshE3WJjxDTvLpKt7dsqBiJwOw9_0jZ2TMf48WYFULnOZY_-fU4ydqNmdrQiRj_xSNxNAsW4AtD5ekC5w4lRyaUjBjUMujoe9AIRL03wExiNqKVo98QCxE4S9Izi22VxWS3_Bf7UC4vmulORDl7u_W5bdzK3kZTKY5qplpaOa69-D8zoCp3qpfgcF60FF9a8trngD6jfk4x94ifgMS0r0oUs6XcQfRA0sV0F9sg9h5Hz3O4rv7j8oqDGe6uDfSr84XHKrWMik7tZvb3FeFIWecxv13YUW03X4P7SAidQja-pnXtSix00mtXGelbGzdmDQnZ3jf3Hg0Dz3l2fo47wjFernWLkJgxT7dNolwA0HNPax7Xe0aQJyhaJcMwm2WysMFIo-PK04nFHpNg9tiU7ctkyToAFVvMoRuspkvYjXx3BhC9FsaaA--88uxeQWGh8N2Xll6yfyYdLO1BIg0WdbMPiNul9GfcyzXdNN31wNFZIE7lSjDHOeVRZLtXsAhdTEa3idgLMnsxPuv6mTtNAKX8C5rgFpdU86-rNFSy2dFoJPn_D4mmio2CudD0QuUPimlr40vI4eSn9jvD9LxIi74Nw5U9ydGtgqQ0kI22_-6oIXUqiKOMVbXgWmNfzelv20bZHdjIi-QNOkMFM_uPk3xMZE785PAf-qayrv9BgY7ovnaT7PgWvMZTyxJ8FfUG6wdPpku2PHRFS2rJDmZEYRx3_A5hbJNvcLnlOSdoZ015cZ3Tiu51neY7XiBSXDFU-II4dgQ5esqA41i_flC8alNqJw5n9h1u6zy1gKx07qQbnrpwX9SF8KX7J25D9PDFVricVuQIGX9nGCMFQ_XiiqJnkBBih6YhTBEIUS5buass274V5MiGh1cmXkUD3glbSfeZu4909Zq9019cNC7YOjt8m0jkTsaBTlVeXw_kTrcpVbk0wCq7a2zrf4YgUHneIchq8thgY-vomsbzYcS3Dp0ErvObm5bs8_m2zkmI_Isb8uJujAhSOK8sU-Zm4gT94jXd&isca=1"
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
If you're not, please file an issue under https://github.com/getsentry/sentry/issues/new/choose and mention @getsentry/owners-sentry-dev

You can configure the behaviour of direnv by adding the following variables to a .env file:

- SENTRY_DIRENV_DEBUG=1: This will allow printing debug messages
- SENTRY_DEVENV_NO_REPORT=1: Do not report development environment errors to Sentry.io
EOF
}
