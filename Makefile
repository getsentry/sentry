STATIC_DIR = src/sentry/static/sentry

ifneq "$(wildcard /usr/local/opt/libxmlsec1/lib)" ""
	LDFLAGS += -L/usr/local/opt/libxmlsec1/lib
endif
ifneq "$(wildcard /usr/local/opt/openssl/lib)" ""
	LDFLAGS += -L/usr/local/opt/openssl/lib
endif

PIP := LDFLAGS="$(LDFLAGS)" python -m pip
# Note: this has to be synced with the pip version in .travis.yml.
PIP_VERSION := 19.2.3
PIP_OPTS := --no-use-pep517 --disable-pip-version-check
WEBPACK := NODE_ENV=production ./bin/yarn webpack
YARN := ./bin/yarn

bootstrap: develop init-config run-dependent-services create-db apply-migrations

develop: ensure-venv setup-git develop-only

develop-only: ensure-venv update-submodules install-yarn-pkgs install-sentry-dev

init-config:
	sentry init --dev

run-dependent-services:
	sentry devservices up

test: develop lint test-js test-python test-cli

build: locale

drop-db:
	@echo "--> Dropping existing 'sentry' database"
	docker exec $$(docker ps --filter 'name=sentry_postgres' --format '{{.ID}}') \
		dropdb -U postgres sentry || true

create-db:
	@echo "--> Creating 'sentry' database"
	docker exec $$(docker ps --filter 'name=sentry_postgres' --format '{{.ID}}') \
		createdb -U postgres -E utf-8 sentry || true

apply-migrations:
	@echo "--> Applying migrations"
	sentry upgrade

reset-db: drop-db create-db apply-migrations

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

ensure-venv:
	@./scripts/ensure-venv.sh

ensure-latest-pip:
	$(PIP) install "pip==$(PIP_VERSION)"

setup-git: ensure-latest-pip
	@echo "--> Installing git hooks"
	git config branch.autosetuprebase always
	git config core.ignorecase false
	cd .git/hooks && ln -sf ../../config/hooks/* ./
	$(PIP) install "pre-commit==1.18.2" $(PIP_OPTS)
	pre-commit install --install-hooks
	@echo ""

update-submodules:
	@echo "--> Updating git submodules"
	git submodule init
	git submodule update
	@echo ""

node-version-check:
	@test "$$(node -v)" = v"$$(cat .nvmrc)" || (echo 'node version does not match .nvmrc. Recommended to use https://github.com/creationix/nvm'; exit 1)

install-yarn-pkgs:
	@echo "--> Installing Yarn packages (for development)"
	@command -v $(YARN) 2>&1 > /dev/null || (echo 'yarn not found. Please install it before proceeding.'; exit 1)
	# Use NODE_ENV=development so that yarn installs both dependencies + devDependencies
	NODE_ENV=development $(YARN) install --pure-lockfile
	# A common problem is with node packages not existing in `node_modules` even though `yarn install`
	# says everything is up to date. Even though `yarn install` is run already, it doesn't take into
	# account the state of the current filesystem (it only checks .yarn-integrity).
	# Add an additional check against `node_modules`
	$(YARN) check --verify-tree || $(YARN) install --check-files

install-sentry-dev:
	@echo "--> Installing Sentry (for development)"
	$(PIP) install -e ".[dev]" $(PIP_OPTS)

build-js-po: node-version-check
	mkdir -p build
	SENTRY_EXTRACT_TRANSLATIONS=1 $(WEBPACK)

locale: build-js-po
	cd src/sentry && sentry django makemessages -i static -l en
	./bin/merge-catalogs en
	./bin/find-good-catalogs src/sentry/locale/catalogs.json
	cd src/sentry && sentry django compilemessages

update-transifex: build-js-po
	$(PIP) install transifex-client $(PIP_OPTS)
	cd src/sentry && sentry django makemessages -i static -l en
	./bin/merge-catalogs en
	tx push -s
	tx pull -a
	./bin/find-good-catalogs src/sentry/locale/catalogs.json
	cd src/sentry && sentry django compilemessages

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
	cd test_cli && sentry init test_conf > /dev/null
	cd test_cli && sentry --config=test_conf upgrade --traceback --noinput > /dev/null
	cd test_cli && sentry --config=test_conf help 2>&1 | grep start > /dev/null
	rm -r test_cli
	@echo ""

test-js: node-version-check
	@echo "--> Building static assets"
	@$(WEBPACK) --profile --json > .artifacts/webpack-stats.json
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
	py.test tests/acceptance --cov . --cov-report="xml:.artifacts/acceptance.coverage.xml" --junit-xml=".artifacts/acceptance.junit.xml" --html=".artifacts/acceptance.pytest.html"
else
	py.test tests/acceptance -m group_$(TEST_GROUP) --cov . --cov-report="xml:.artifacts/acceptance.coverage.xml" --junit-xml=".artifacts/acceptance.junit.xml" --html=".artifacts/acceptance.pytest.html"
endif

	@echo ""

test-plugins:
	@echo "--> Building static assets"
	@$(WEBPACK) --display errors-only
	@echo "--> Running plugin tests"
	py.test tests/sentry_plugins -vv --cov . --cov-report="xml:.artifacts/plugins.coverage.xml" --junit-xml=".artifacts/plugins.junit.xml"
	@echo ""

lint: lint-python lint-js

# configuration for flake8 can be found in setup.cfg
lint-python:
	@echo "--> Linting python"
	bash -eo pipefail -c "flake8 | tee .artifacts/flake8.pycodestyle.log"
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

publish:
	python setup.py sdist bdist_wheel upload


.PHONY: develop develop-only test build test reset-db clean setup-git update-submodules node-version-check install-yarn-pkgs install-sentry-dev build-js-po locale update-transifex build-platform-assets test-cli test-js test-styleguide test-python test-snuba test-symbolicator test-acceptance lint lint-python lint-js publish


############################
# Halt, Travis stuff below #
############################

.PHONY: travis-noop
travis-noop:
	@echo "nothing to do here."

.PHONY: travis-test-lint
travis-test-lint: lint-python lint-js

.PHONY: travis-test-postgres travis-test-acceptance travis-test-snuba travis-test-symbolicator travis-test-js travis-test-cli travis-test-dist
travis-test-postgres: test-python
travis-test-acceptance: test-acceptance
travis-test-snuba: test-snuba
travis-test-symbolicator: test-symbolicator
travis-test-js: test-js
travis-test-cli: test-cli
travis-test-plugins: test-plugins
travis-test-dist:
	# NOTE: We quiet down output here to workaround an issue in travis that
	# causes the build to fail with a EAGAIN when writing a large amount of
	# data to STDOUT.
	# See: https://github.com/travis-ci/travis-ci/issues/4704
	SENTRY_BUILD=$(TRAVIS_COMMIT) SENTRY_LIGHT_BUILD=0 python setup.py -q sdist bdist_wheel
	@ls -lh dist/

.PHONY: scan-python travis-scan-postgres travis-scan-acceptance travis-scan-snuba travis-scan-symbolicator travis-scan-js travis-scan-cli travis-scan-dist travis-scan-lint
scan-python:
	@echo "--> Running Python vulnerability scanner"
	$(PIP) install safety $(PIP_OPTS)
	bin/scan
	@echo ""

travis-scan-postgres: travis-noop
travis-scan-acceptance: travis-noop
travis-scan-snuba: travis-noop
travis-scan-symbolicator: travis-noop
travis-scan-js: travis-noop
travis-scan-cli: travis-noop
travis-scan-dist: travis-noop
travis-scan-lint: scan-python
travis-scan-plugins: travis-noop
