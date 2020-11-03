PIP := python -m pip --disable-pip-version-check
WEBPACK := yarn build-acceptance

# Currently, this is only required to install black via pre-commit.
REQUIRED_PY3_VERSION := $(shell awk 'FNR == 2' .python-version)

bootstrap: develop init-config run-dependent-services create-db apply-migrations build-platform-assets

develop: ensure-pinned-pip setup-git install-js-dev install-py-dev

clean:
	@echo "--> Cleaning static cache"
	rm -rf dist/* static/dist/*
	@echo "--> Cleaning integration docs cache"
	rm -rf src/sentry/integration-docs
	@echo "--> Cleaning pyc files"
	find . -name "*.pyc" -delete
	@echo "--> Cleaning python build artifacts"
	rm -rf build/ dist/ src/sentry/assets.json
	@echo ""

init-config: ensure-venv
	sentry init --dev

run-dependent-services: ensure-venv
	sentry devservices up

DROPDB := $(shell command -v dropdb 2> /dev/null)
ifndef DROPDB
	DROPDB = docker exec sentry_postgres dropdb
endif
CREATEDB := $(shell command -v createdb 2> /dev/null)
ifndef CREATEDB
	CREATEDB = docker exec sentry_postgres createdb
endif

drop-db:
	@echo "--> Dropping existing 'sentry' database"
	$(DROPDB) -h 127.0.0.1 -U postgres sentry || true

create-db:
	@echo "--> Creating 'sentry' database"
	$(CREATEDB) -h 127.0.0.1 -U postgres -E utf-8 sentry || true

apply-migrations: ensure-venv
	@echo "--> Applying migrations"
	sentry upgrade

reset-db: drop-db create-db apply-migrations

setup-pyenv:
	@cat .python-version | xargs -n1 pyenv install --skip-existing

ensure-venv:
	@./scripts/ensure-venv.sh

ensure-pinned-pip: ensure-venv
	$(PIP) install --no-cache-dir --upgrade "pip>=20.0.2"

setup-git-config:
	@git config --local branch.autosetuprebase always
	@git config --local core.ignorecase false
	@git config --local blame.ignoreRevsFile .git-blame-ignore-revs

setup-git: ensure-venv setup-git-config
	@echo "--> Installing git hooks"
	mkdir -p .git/hooks && cd .git/hooks && ln -sf ../../config/hooks/* ./
	@PYENV_VERSION=$(REQUIRED_PY3_VERSION) python3 -c '' || (echo 'Please run `make setup-pyenv` to install the required Python 3 version.'; exit 1)
	@# pre-commit loosely pins virtualenv, which has caused problems in the past.
	$(PIP) install "pre-commit==1.18.2" "virtualenv==20.0.32"
	@PYENV_VERSION=$(REQUIRED_PY3_VERSION) pre-commit install --install-hooks
	@echo ""

node-version-check:
	@# Checks to see if node's version matches the one specified in package.json for Volta.
	@node -pe "process.exit(Number(!(process.version == 'v' + require('./package.json').volta.node )))" || \
	(echo 'Unexpected node version. Recommended to use https://github.com/volta-cli/volta'; exit 1)

install-js-dev: node-version-check
	@echo "--> Installing Yarn packages (for development)"
	# Use NODE_ENV=development so that yarn installs both dependencies + devDependencies
	NODE_ENV=development yarn install --frozen-lockfile
	# A common problem is with node packages not existing in `node_modules` even though `yarn install`
	# says everything is up to date. Even though `yarn install` is run already, it doesn't take into
	# account the state of the current filesystem (it only checks .yarn-integrity).
	# Add an additional check against `node_modules`
	yarn check --verify-tree || yarn install --check-files

install-py-dev: ensure-pinned-pip
	@echo "--> Installing Sentry (for development)"
	# SENTRY_LIGHT_BUILD=1 disables webpacking during setup.py.
	# Webpacked assets are only necessary for devserver (which does it lazily anyways)
	# and acceptance tests, which webpack automatically if run.
	SENTRY_LIGHT_BUILD=1 $(PIP) install -e ".[dev]"

build-js-po: node-version-check
	mkdir -p build
	SENTRY_EXTRACT_TRANSLATIONS=1 $(WEBPACK)

build: locale

merge-locale-catalogs: build-js-po
	$(PIP) install Babel
	cd src/sentry && sentry django makemessages -i static -l en
	./bin/merge-catalogs en

compile-locale:
	./bin/find-good-catalogs src/sentry/locale/catalogs.json
	cd src/sentry && sentry django compilemessages

locale: merge-locale-catalogs compile-locale

sync-transifex: merge-locale-catalogs
	$(PIP) install transifex-client
	tx push -s
	tx pull -a

update-transifex: sync-transifex compile-locale

build-platform-assets:
	@echo "--> Building platform assets"
	@echo "from sentry.utils.integrationdocs import sync_docs; sync_docs(quiet=True)" | sentry exec

fetch-release-registry:
	@echo "--> Fetching release registry"
	@echo "from sentry.utils.distutils import sync_registry; sync_registry()" | sentry exec

run-acceptance:
	@echo "--> Running acceptance tests"
	py.test tests/acceptance --cov . --cov-report="xml:.artifacts/acceptance.coverage.xml" --junit-xml=".artifacts/acceptance.junit.xml" --html=".artifacts/acceptance.pytest.html" --self-contained-html
	@echo ""

test-cli:
	@echo "--> Testing CLI"
	rm -rf test_cli
	mkdir test_cli
	cd test_cli && sentry init test_conf
	cd test_cli && sentry --config=test_conf help
	cd test_cli && sentry --config=test_conf upgrade --traceback --noinput
	cd test_cli && sentry --config=test_conf export
	rm -r test_cli
	@echo ""

test-js-build: node-version-check
	@echo "--> Running type check"
	@yarn run tsc -p config/tsconfig.build.json
	@echo "--> Building static assets"
	@NODE_ENV=production yarn webpack-profile > .artifacts/webpack-stats.json

test-js: node-version-check
	@echo "--> Running JavaScript tests"
	@yarn run test
	@echo ""

test-js-ci: node-version-check
	@echo "--> Running CI JavaScript tests"
	@yarn run test-ci
	@echo ""

test-python:
	@echo "--> Running Python tests"
	# This gets called by getsentry
	py.test tests/integration tests/sentry

test-python-ci:
	make build-platform-assets
	@echo "--> Running CI Python tests"
	py.test tests/integration tests/sentry --cov . --cov-report="xml:.artifacts/python.coverage.xml" --junit-xml=".artifacts/python.junit.xml" || exit 1
	@echo ""

test-snuba:
	@echo "--> Running snuba tests"
	py.test tests/snuba tests/sentry/eventstream/kafka tests/sentry/snuba/test_discover.py -vv --cov . --cov-report="xml:.artifacts/snuba.coverage.xml" --junit-xml=".artifacts/snuba.junit.xml"
	@echo ""

test-symbolicator:
	@echo "--> Running symbolicator tests"
	py.test tests/symbolicator -vv --cov . --cov-report="xml:.artifacts/symbolicator.coverage.xml" --junit-xml=".artifacts/symbolicator.junit.xml"
	@echo ""

test-acceptance: node-version-check
	@echo "--> Building static assets"
	@$(WEBPACK)
	make run-acceptance

test-plugins:
	@echo "--> Building static assets"
	@$(WEBPACK)
	@echo "--> Running plugin tests"
	py.test tests/sentry_plugins -vv --cov . --cov-report="xml:.artifacts/plugins.coverage.xml" --junit-xml=".artifacts/plugins.junit.xml" || exit 1
	@echo ""

test-relay-integration:
	@echo "--> Running Relay integration tests"
	pytest tests/relay_integration -vv
	@echo ""

test-api-docs:
	@echo "--> Generating testing api doc schema"
	yarn run build-derefed-docs
	@echo "--> Validating endpoints' examples against schemas"
	yarn run validate-api-examples
	pytest tests/apidocs/endpoints
	@echo ""

review-python-snapshots:
	@cargo insta --version &> /dev/null || cargo install cargo-insta
	@cargo insta review --workspace-root `pwd` -e pysnap

accept-python-snapshots:
	@cargo insta --version &> /dev/null || cargo install cargo-insta
	@cargo insta accept --workspace-root `pwd` -e pysnap

reject-python-snapshots:
	@cargo insta --version &> /dev/null || cargo install cargo-insta
	@cargo insta reject --workspace-root `pwd` -e pysnap

lint-js:
	@echo "--> Linting javascript"
	bin/lint --js --parseable
	@echo ""


.PHONY: develop build reset-db clean setup-git node-version-check install-js-dev install-py-dev build-js-po locale compile-locale merge-locale-catalogs sync-transifex update-transifex build-platform-assets test-cli test-js test-js-build test-styleguide test-python test-snuba test-symbolicator test-acceptance lint-js


############################
# Halt, Travis stuff below #
############################

.PHONY: travis-noop
travis-noop:
	@echo "nothing to do here."

.PHONY: travis-test-lint-js
travis-test-lint-js: lint-js

.PHONY: travis-test-postgres travis-test-acceptance travis-test-snuba travis-test-symbolicator travis-test-js travis-test-js-build
.PHONY: travis-test-cli travis-test-relay-integration
travis-test-postgres: test-python-ci
travis-test-acceptance: test-acceptance
travis-test-snuba: test-snuba
travis-test-symbolicator: test-symbolicator
travis-test-js: test-js-ci
travis-test-js-build: test-js-build
travis-test-cli: test-cli
travis-test-plugins: test-plugins
travis-test-relay-integration: test-relay-integration
