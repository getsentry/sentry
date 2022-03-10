PIP := python -m pip --disable-pip-version-check
WEBPACK := yarn build-acceptance

bootstrap \
develop \
clean \
init-config \
run-dependent-services \
drop-db \
create-db \
apply-migrations \
reset-db \
setup-apple-m1 \
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
	@ts-node api-docs/watch.ts

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
	pytest tests/snuba tests/sentry/eventstream/kafka tests/sentry/snuba/test_discover.py tests/sentry/search/events -vv --cov . --cov-report="xml:.artifacts/snuba.coverage.xml" --junit-xml=".artifacts/snuba.junit.xml"
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

test-api-docs: build-api-docs
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


.PHONY: build
