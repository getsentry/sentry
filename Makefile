.PHONY: all
all: develop

PIP := python -m pip --disable-pip-version-check
WEBPACK := yarn build-acceptance
POSTGRES_CONTAINER := sentry_postgres

freeze-requirements:
	@python3 -S -m tools.freeze_requirements

bootstrap \
develop \
clean \
init-config \
run-dependent-services \
drop-db \
create-db \
apply-migrations \
reset-db \
setup-git \
node-version-check \
install-js-dev \
install-py-dev :
	@./scripts/do.sh $@

build-platform-assets \
direnv-help \
upgrade-pip \
prerequisites \
setup-git-config :
	@SENTRY_NO_VENV_CHECK=1 ./scripts/do.sh $@

setup-pyenv:
	@./scripts/pyenv_setup.sh

build-js-po: node-version-check
	mkdir -p build
	rm -rf node_modules/.cache/babel-loader
	SENTRY_EXTRACT_TRANSLATIONS=1 $(WEBPACK)

build-spectacular-docs:
	@echo "--> Building drf-spectacular openapi spec (combines with deprecated docs)"
	@OPENAPIGENERATE=1 sentry django spectacular --file tests/apidocs/openapi-spectacular.json --format openapi-json --validate --fail-on-warn

build-deprecated-docs:
	@echo "--> Building deprecated openapi spec from json files"
	yarn build-deprecated-docs

build-api-docs: build-deprecated-docs build-spectacular-docs
	@echo "--> Dereference the json schema for ease of use"
	yarn deref-api-docs

watch-api-docs:
	@cd api-docs/ && yarn install
	@cd api-docs/ && ts-node ./watch.ts

diff-api-docs:
	@echo "--> diffing local api docs against sentry-api-schema/openapi-derefed.json"
	yarn diff-docs

build: locale

merge-locale-catalogs: build-js-po
	$(PIP) install Babel
	cd src/sentry && sentry django makemessages -i static -l en
	./bin/merge-catalogs en

compile-locale:
	$(PIP) install Babel
	./bin/find-good-catalogs src/sentry/locale/catalogs.json
	cd src/sentry && sentry django compilemessages

install-transifex:
	$(PIP) install transifex-client

push-transifex: merge-locale-catalogs install-transifex
	tx push -s

pull-transifex: install-transifex
	tx pull -a

# Update transifex with new strings that need to be translated
update-transifex: push-transifex

# Pulls new translations from transifex and compiles for usage
update-local-locales: pull-transifex compile-locale

build-chartcuterie-config:
	@echo "--> Building chartcuterie config module"
	yarn build-chartcuterie-config

fetch-release-registry:
	@echo "--> Fetching release registry"
	@echo "from sentry.utils.distutils import sync_registry; sync_registry()" | sentry exec

run-acceptance:
	@echo "--> Running acceptance tests"
	pytest tests/acceptance --cov . --cov-report="xml:.artifacts/acceptance.coverage.xml"
	@echo ""

test-cli: create-db
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

# COV_ARGS controls extra args passed to pytest to generate covereage
# It's used in test-python-ci. Typically generated an XML coverage file
# Except in .github/workflows/codecov_per_test_coverage.yml
# When it's dynamically changed to include --cov-context=test flag
# See that workflow for more info
COV_ARGS = --cov-report="xml:.artifacts/python.coverage.xml"

test-python-ci:
	@echo "--> Running CI Python tests"
	pytest \
		tests \
		--ignore tests/acceptance \
		--ignore tests/apidocs \
		--ignore tests/js \
		--ignore tests/tools \
		--cov . $(COV_ARGS)
	@echo ""

# it's not possible to change settings.DATABASE after django startup, so
# unfortunately these tests must be run in a separate pytest process. References:
#   * https://docs.djangoproject.com/en/4.2/topics/testing/tools/#overriding-settings
#   * https://code.djangoproject.com/ticket/19031
#   * https://github.com/pombredanne/django-database-constraints/blob/master/runtests.py#L61-L77
test-monolith-dbs:
	@echo "--> Running CI Python tests (SENTRY_USE_MONOLITH_DBS=1)"
	SENTRY_LEGACY_TEST_SUITE=1 \
	SENTRY_USE_MONOLITH_DBS=1 \
	pytest \
	  tests/sentry/backup/test_exhaustive.py \
	  tests/sentry/backup/test_exports.py \
	  tests/sentry/backup/test_imports.py \
	  tests/sentry/backup/test_releases.py \
	  tests/sentry/runner/commands/test_backup.py \
	  --cov . \
	  --cov-report="xml:.artifacts/python.monolith-dbs.coverage.xml" \
	;
	@echo ""

test-tools:
	@echo "--> Running tools tests"
	pytest -c /dev/null --confcutdir tests/tools tests/tools -vv --cov=tools --cov=tests/tools --cov-report="xml:.artifacts/tools.coverage.xml"
	@echo ""

# JavaScript relay tests are meant to be run within Symbolicator test suite, as they are parametrized to verify both processing pipelines during migration process.
# Running Locally: Run `sentry devservices up kafka` before starting these tests
test-symbolicator:
	@echo "--> Running symbolicator tests"
	pytest tests/symbolicator -vv --cov . --cov-report="xml:.artifacts/symbolicator.coverage.xml"
	pytest tests/relay_integration/lang/javascript/ -vv -m symbolicator
	@echo ""

test-acceptance: node-version-check
	@echo "--> Building static assets"
	@$(WEBPACK)
	make run-acceptance

# XXX: this is called by `getsentry/relay`
test-relay-integration:
	@echo "--> Running Relay integration tests"
	pytest \
		tests/relay_integration \
		tests/sentry/ingest/ingest_consumer/test_ingest_consumer_kafka.py \
		-vv --cov . --cov-report="xml:.artifacts/relay.coverage.xml"
	@echo ""

test-api-docs: build-api-docs
	yarn run validate-api-examples
	pytest tests/apidocs
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


.PHONY: build
