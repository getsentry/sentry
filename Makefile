PIP := python -m pip --disable-pip-version-check
WEBPACK := NODE_ENV=production ./bin/yarn webpack
YARN := ./bin/yarn

bootstrap: develop init-config run-dependent-services create-db apply-migrations

develop: ensure-pinned-pip setup-git install-yarn-pkgs install-sentry-dev

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
	cd .git/hooks && ln -sf ../../config/hooks/* ./
	@# XXX(joshuarli): virtualenv >= 20 doesn't work with the version of six we have pinned for sentry.
	@# Since pre-commit is installed in the venv, it will install virtualenv in the venv as well.
	@# We need to tell pre-commit to install an older virtualenv,
	@# And we need to tell virtualenv to install an older six, so that sentry installation
	@# won't complain about a newer six being present.
	@# So, this six pin here needs to be synced with requirements-base.txt.
	$(PIP) install "pre-commit==1.18.2" "virtualenv>=16.7,<20" "six>=1.10.0,<1.11.0"
	pre-commit install --install-hooks
	@echo ""

node-version-check:
	@test "$$(node -v)" = v"$$(cat .nvmrc)" || (echo 'node version does not match .nvmrc. Recommended to use https://github.com/volta-cli/volta'; exit 1)

install-yarn-pkgs: node-version-check
	@echo "--> Installing Yarn packages (for development)"
	# Use NODE_ENV=development so that yarn installs both dependencies + devDependencies
	NODE_ENV=development $(YARN) install --frozen-lockfile
	# A common problem is with node packages not existing in `node_modules` even though `yarn install`
	# says everything is up to date. Even though `yarn install` is run already, it doesn't take into
	# account the state of the current filesystem (it only checks .yarn-integrity).
	# Add an additional check against `node_modules`
	$(YARN) check --verify-tree || $(YARN) install --check-files

install-sentry-dev: ensure-pinned-pip
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
	@$(YARN) run tsc
	@echo "--> Building static assets"
	@$(WEBPACK) --profile --json > .artifacts/webpack-stats.json

test-js: node-version-check
	@echo "--> Running JavaScript tests"
	@$(YARN) run test-ci
	@echo ""

# builds and creates percy snapshots
test-styleguide:
	@echo "--> Building and snapshotting styleguide"
	@$(YARN) run snapshot
	@echo ""

test-python:
	sentry init
	make build-platform-assets
	@echo "--> Running Python tests"
ifndef TEST_GROUP
	py.test tests/integration tests/sentry --cov . --cov-report="xml:.artifacts/python.coverage.xml" --junit-xml=".artifacts/python.junit.xml" || exit 1
else
	py.test tests/integration tests/sentry -m group_$(TEST_GROUP) --cov . --cov-report="xml:.artifacts/python.coverage.xml" --junit-xml=".artifacts/python.junit.xml" || exit 1
endif
	@echo ""

test-snuba:
	@echo "--> Running snuba tests"
	py.test tests/snuba tests/sentry/eventstream/kafka -vv --cov . --cov-report="xml:.artifacts/snuba.coverage.xml" --junit-xml=".artifacts/snuba.junit.xml"
	@echo ""

test-symbolicator:
	@echo "--> Running symbolicator tests"
	py.test tests/symbolicator -vv --cov . --cov-report="xml:.artifacts/symbolicator.coverage.xml" --junit-xml=".artifacts/symbolicator.junit.xml"
	@echo ""

test-acceptance: node-version-check
	sentry init
	@echo "--> Building static assets"
	@$(WEBPACK) --display errors-only
	@echo "--> Running acceptance tests"
ifndef TEST_GROUP
	py.test tests/acceptance --cov . --cov-report="xml:.artifacts/acceptance.coverage.xml" --junit-xml=".artifacts/acceptance.junit.xml" --html=".artifacts/acceptance.pytest.html" --self-contained-html
else
	py.test tests/acceptance -m group_$(TEST_GROUP) --cov . --cov-report="xml:.artifacts/acceptance.coverage.xml" --junit-xml=".artifacts/acceptance.junit.xml" --html=".artifacts/acceptance.pytest.html" --self-contained-html
endif

	@echo ""

test-plugins:
	@echo "--> Building static assets"
	@$(WEBPACK) --display errors-only
	@echo "--> Running plugin tests"
	py.test tests/sentry_plugins -vv --cov . --cov-report="xml:.artifacts/plugins.coverage.xml" --junit-xml=".artifacts/plugins.junit.xml"
	@echo ""

test-relay-integration:
	@echo "--> Running Relay integration tests"
	pytest tests/relay_integration -vv
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


.PHONY: develop build reset-db clean setup-git node-version-check install-yarn-pkgs install-sentry-dev build-js-po locale compile-locale merge-locale-catalogs sync-transifex update-transifex build-platform-assets test-cli test-js test-js-build test-styleguide test-python test-snuba test-symbolicator test-acceptance lint-js


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
travis-test-postgres: test-python
travis-test-acceptance: test-acceptance
travis-test-snuba: test-snuba
travis-test-symbolicator: test-symbolicator
travis-test-js: test-js
travis-test-js-build: test-js-build
travis-test-cli: test-cli
travis-test-plugins: test-plugins
travis-test-relay-integration: test-relay-integration
