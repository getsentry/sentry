#!/bin/bash
set -eu

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")"; pwd -P)"
# shellcheck disable=SC1090
source "${HERE}/lib.sh"

if ! require sentry-cli; then
    curl -sL https://sentry.io/get-cli/ | bash
fi
# SENTRY_DSN already defined in .envrc
[ -n "${SENTRY_DSN+x}" ] && [ -z "${SENTRY_DEVENV_NO_REPORT+x}" ] && \
    eval "$(sentry-cli bash-hook)"

alias pip="python -m pip --disable-pip-version-check"

setup-git-config() {
    git config --local branch.autosetuprebase always
	git config --local core.ignorecase false
	git config --local blame.ignoreRevsFile .git-blame-ignore-revs
}

setup-git() {
    echo "--> Installing git hooks"
	mkdir -p .git/hooks && cd .git/hooks && ln -sf ../../config/hooks/* ./ && cd -
	# shellcheck disable=SC2016
	python3 -c '' || (echo 'Please run `make setup-pyenv` to install the required Python 3 version.'; exit 1)
	pip install -r requirements-pre-commit.txt
	pre-commit install --install-hooks
	echo ""
}

install-js-dev() {
    echo "--> Installing Yarn packages (for development)"
	# Use NODE_ENV=development so that yarn installs both dependencies + devDependencies
	NODE_ENV=development yarn install --frozen-lockfile
	# A common problem is with node packages not existing in `node_modules` even though `yarn install`
	# says everything is up to date. Even though `yarn install` is run already, it doesn't take into
	# account the state of the current filesystem (it only checks .yarn-integrity).
	# Add an additional check against `node_modules`
	yarn check --verify-tree || yarn install --check-files
}

main() {
    setup-git
    install-js-dev
}

"$@"
