PIP := python -m pip --disable-pip-version-check
WEBPACK := yarn build-acceptance

bootstrap: develop init-config run-dependent-services create-db apply-migrations build-platform-assets

develop:
	@./scripts/do.sh develop

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

init-config:
	@./scripts/do.sh init-config

run-dependent-services:
	@./scripts/do.sh run-dependent-services

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

apply-migrations:
	@./scripts/do.sh apply-migrations

reset-db: drop-db create-db apply-migrations

setup-pyenv:
	@./scripts/pyenv_setup.sh

upgrade-pip:
	@SENTRY_NO_VENV_CHECK=1 ./scripts/do.sh upgrade-pip

setup-git-config:
	@SENTRY_NO_VENV_CHECK=1 ./scripts/do.sh setup-git-config

setup-git:
	@./scripts/do.sh setup-git

node-version-check:
	@# Checks to see if node's version matches the one specified in package.json for Volta.
	@node -pe "process.exit(Number(!(process.version == 'v' + require('./package.json').volta.node )))" || \
	(echo 'Unexpected node version. Recommended to use https://github.com/volta-cli/volta'; exit 1)

install-js-dev: node-version-check
	@./scripts/do.sh install-js-dev

install-py-dev:
	@./scripts/do.sh install-py-dev

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

build-chartcuterie-config:
	@echo "--> Building chartcuterie config module"
	yarn build-chartcuterie-config

fetch-release-registry:
	@echo "--> Fetching release registry"
	@echo "from sentry.utils.distutils import sync_registry; sync_registry()" | sentry exec

run-acceptance:
	@echo "--> Running acceptance tests"
	pytest tests/acceptance --cov . --cov-report="xml:.artifacts/acceptance.coverage.xml" --junit-xml=".artifacts/acceptance.junit.xml"
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
	pytest tests/integration tests/sentry

test-python-ci:
	make build-platform-assets
	@echo "--> Running CI Python tests"
	pytest tests/integration tests/sentry --cov . --cov-report="xml:.artifacts/python.coverage.xml" --junit-xml=".artifacts/python.junit.xml" || exit 1
	@echo ""

test-snuba:
	@echo "--> Running snuba tests"
	pytest tests/snuba tests/sentry/eventstream/kafka tests/sentry/snuba/test_discover.py -vv --cov . --cov-report="xml:.artifacts/snuba.coverage.xml" --junit-xml=".artifacts/snuba.junit.xml"
	@echo ""

backend-typing:
	@echo "--> Running Python typing checks"
	mypy --strict --warn-unreachable --config-file mypy.ini
	@echo ""

test-symbolicator:
	@echo "--> Running symbolicator tests"
	pytest tests/symbolicator -vv --cov . --cov-report="xml:.artifacts/symbolicator.coverage.xml" --junit-xml=".artifacts/symbolicator.junit.xml"
	@echo ""

test-chartcuterie:
	@echo "--> Running chartcuterie tests"
	pytest tests/chartcuterie -vv --cov . --cov-report="xml:.artifacts/chartcuterie.coverage.xml" --junit-xml=".artifacts/chartcuterie.junit.xml"
	@echo ""

test-acceptance: node-version-check
	@echo "--> Building static assets"
	@$(WEBPACK)
	make run-acceptance

test-plugins:
	@echo "--> Running plugin tests"
	pytest tests/sentry_plugins -vv --cov . --cov-report="xml:.artifacts/plugins.coverage.xml" --junit-xml=".artifacts/plugins.junit.xml" || exit 1
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


.PHONY: bootstrap \
        develop \
        clean \
        init-config \
        run-dependent-services \
        drop-db \
        create-db \
        apply-migrations \
        reset-db \
        setup-pyenv \
        setup-git-config \
        setup-git \
        node-version-check \
        install-js-dev \
        install-py-dev \
        build-js-po \
        build \
        merge-locale-catalogs \
        compile-locale \
        locale \
        sync-transifex \
        update-transifex \
        build-platform-assets \
        build-chartcuterie-config \
        fetch-release-registry \
        run-acceptance \
        test-cli \
        test-js-build \
        test-js \
        test-js-ci \
        test-python \
        test-python-ci \
        test-snuba \
        test-symbolicator \
        test-chartcuterie \
        test-acceptance \
        test-plugins \
        test-relay-integration \
        test-api-docs \
        review-python-snapshots \
        accept-python-snapshots \
        reject-python-snapshots \
        lint-js
