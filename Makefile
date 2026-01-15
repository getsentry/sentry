.PHONY: all
all: develop

WEBPACK := pnpm run build-acceptance

freeze-requirements:
	@uv lock

bootstrap:
	@echo "devenv bootstrap is typically run on new machines."
	@echo "you probably want to run devenv sync to bring the"
	@echo "sentry dev environment up to date!"

build-platform-assets \
clean \
init-config \
run-dependent-services \
drop-db \
create-db \
apply-migrations \
reset-db :
	@./scripts/do.sh $@

develop \
install-js-dev \
install-py-dev :
	@make devenv-sync

# This is to ensure devenv sync's only called once if the above
# macros are combined e.g. `make install-js-dev install-py-dev`
.PHONY: devenv-sync
devenv-sync:
	devenv sync

build-js-po:
	mkdir -p build
	pnpm run build-js-po

build-spectacular-docs:
	@echo "--> Building drf-spectacular openapi spec (combines with deprecated docs)"
	@OPENAPIGENERATE=1 sentry django spectacular --file tests/apidocs/openapi-spectacular.json --format openapi-json --validate --fail-on-warn

build-deprecated-docs:
	@echo "--> Building deprecated openapi spec from json files"
	pnpm run build-deprecated-docs

build-api-docs: build-deprecated-docs build-spectacular-docs
	@echo "--> Dereference the json schema for ease of use"
	pnpm run deref-api-docs

watch-api-docs:
	@cd api-docs/ && pnpm install --frozen-lockfile
	@cd api-docs/ && node --experimental-transform-types ./watch.ts

diff-api-docs:
	@echo "--> diffing local api docs against sentry-api-schema/openapi-derefed.json"
	pnpm run diff-docs

build: locale

merge-locale-catalogs: build-js-po
	uv pip install Babel
	cd src/sentry && sentry django makemessages -i static -l en
	./bin/merge-catalogs en

compile-locale:
	uv pip install Babel
	./bin/find-good-catalogs src/sentry/locale/catalogs.json
	cd src/sentry && sentry django compilemessages

install-transifex:
	uv pip install transifex-client

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
	pnpm run build-chartcuterie-config

run-acceptance:
	@echo "--> Running acceptance tests"
	python3 -b -m pytest tests/acceptance --json-report --json-report-file=".artifacts/pytest.acceptance.json" --json-report-omit=log --junit-xml=".artifacts/acceptance.junit.xml" -o junit_suite_name=acceptance
	@echo ""

test-cli: create-db
	@echo "--> Testing CLI"
	rm -rf test_cli
	mkdir test_cli
	cd test_cli && sentry init test_conf
	cd test_cli && sentry --config=test_conf help
	cd test_cli && sentry --config=test_conf upgrade --traceback --noinput
	cd test_cli && sentry --config=test_conf export --help
	rm -r test_cli
	@echo ""

test-js-build:
	@echo "--> Running type check"
	@pnpm run tsc -p tsconfig.json
	@echo "--> Building static assets"
	@NODE_ENV=production pnpm run build-profile > .artifacts/webpack-stats.json

test-js:
	@echo "--> Running JavaScript tests"
	@pnpm run test
	@echo ""

test-js-ci:
	@echo "--> Running CI JavaScript tests"
	@pnpm run test-ci
	@echo ""

test-python-ci:
	@echo "--> Running CI Python tests"
	python3 -b -m pytest \
		tests \
		--ignore tests/acceptance \
		--ignore tests/apidocs \
		--ignore tests/js \
		--ignore tests/tools \
		--json-report \
		--json-report-file=".artifacts/pytest.json" \
		--json-report-omit=log \
		--junit-xml=.artifacts/pytest.junit.xml \
		-o junit_suite_name=pytest
	@echo ""

test-backend-ci-with-coverage:
	@echo "--> Running CI Python tests with coverage"
	COVERAGE_CORE=sysmon python3 -b -m pytest \
		tests \
		--ignore tests/acceptance \
		--ignore tests/apidocs \
		--ignore tests/js \
		--ignore tests/tools \
		--cov . \
		--cov-context=test \
		--json-report \
		--json-report-file=".artifacts/pytest.json" \
		--json-report-omit=log \
		--junit-xml=.artifacts/pytest.junit.xml \
		-o junit_suite_name=pytest
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
	python3 -b -m pytest \
	  tests/sentry/backup/test_exhaustive.py \
	  tests/sentry/backup/test_exports.py \
	  tests/sentry/backup/test_imports.py \
	  tests/sentry/runner/commands/test_backup.py \
	  --json-report \
	  --json-report-file=".artifacts/pytest.monolith-dbs.json" \
	  --json-report-omit=log \
	  --junit-xml=.artifacts/monolith-dbs.junit.xml \
	  -o junit_suite_name=monolith-dbs \
	;
	@echo ""

test-tools:
	@echo "--> Running tools tests"
	@# bogus configuration to force vanilla pytest
	python3 -b -m pytest -c setup.cfg --confcutdir tests/tools tests/tools -vv --junit-xml=.artifacts/tools.junit.xml -o junit_suite_name=tools
	@echo ""

# JavaScript relay tests are meant to be run within Symbolicator test suite, as they are parametrized to verify both processing pipelines during migration process.
# Running Locally: Run `devservices up` before starting these tests
test-symbolicator:
	@echo "--> Running symbolicator tests"
	python3 -b -m pytest tests/symbolicator -vv --junit-xml=.artifacts/symbolicator.junit.xml -o junit_suite_name=symbolicator
	python3 -b -m pytest tests/relay_integration/lang/javascript/ -vv -m symbolicator
	python3 -b -m pytest tests/relay_integration/lang/java/ -vv -m symbolicator
	@echo ""

test-acceptance:
	@echo "--> Building static assets"
	@$(WEBPACK)
	make run-acceptance

# XXX: this is called by `getsentry/relay`
test-relay-integration:
	@echo "--> Running Relay integration tests"
	python3 -b -m pytest \
		tests/relay_integration \
		tests/sentry/ingest/ingest_consumer/test_ingest_consumer_kafka.py \
		-vv
	@echo ""

test-api-docs: build-api-docs
	pnpm run validate-api-examples
	python3 -b -m pytest tests/apidocs
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

.PHONY: build
