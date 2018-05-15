STATIC_DIR = src/sentry/static/sentry

ifneq "$(wildcard /usr/local/opt/libxmlsec1/lib)" ""
	LDFLAGS += -L/usr/local/opt/libxmlsec1/lib
endif
ifneq "$(wildcard /usr/local/opt/openssl/lib)" ""
	LDFLAGS += -L/usr/local/opt/openssl/lib
endif

PIP = LDFLAGS="$(LDFLAGS)" pip -q
WEBPACK = NODE_ENV=production ./node_modules/.bin/webpack

test: develop lint test-js test-python test-cli
develop: setup-git develop-only
# Used by https://github.com/getsentry/sentry-docs/blob/master/bin/extract-docs
develop-only: update-submodules install-system-pkgs install-yarn-pkgs install-sentry-dev

build: locale

dev-docs:
	$(PIP) install -r doc-requirements.txt

reset-db:
	@echo "--> Dropping existing 'sentry' database"
	dropdb sentry || true
	@echo "--> Creating 'sentry' database"
	createdb -E utf-8 sentry
	@echo "--> Applying migrations"
	sentry upgrade

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

setup-git:
	@echo "--> Installing git hooks"
	git config branch.autosetuprebase always
	cd .git/hooks && ln -sf ../../config/hooks/* ./
	@echo ""

update-submodules:
	@echo "--> Updating git submodules"
	git submodule init
	git submodule update
	@echo ""

install-system-pkgs:
	@echo "--> Installing system packages (from Brewfile)"
	@command -v brew 2>&1 > /dev/null && brew bundle || (echo 'WARNING: homebrew not found or brew bundle failed - skipping system dependencies.')

install-yarn-pkgs:
	@echo "--> Installing Yarn packages (for development)"
	@command -v yarn 2>&1 > /dev/null || (echo 'yarn not found. Please install it before proceeding.'; exit 1)
	# Use NODE_ENV=development so that yarn installs both dependencies + devDependencies
	NODE_ENV=development yarn install --pure-lockfile

install-sentry-dev:
	@echo "--> Installing Sentry (for development)"
	$(PIP) install -e ".[dev,tests,optional]"

build-js-po:
	mkdir -p build
	SENTRY_EXTRACT_TRANSLATIONS=1 $(WEBPACK)

locale: build-js-po
	cd src/sentry && sentry django makemessages -i static -l en
	./bin/merge-catalogs en
	./bin/find-good-catalogs src/sentry/locale/catalogs.json
	cd src/sentry && sentry django compilemessages

update-transifex: build-js-po
	pip install -q transifex-client
	cd src/sentry && sentry django makemessages -i static -l en
	./bin/merge-catalogs en
	tx push -s
	tx pull -a
	./bin/find-good-catalogs src/sentry/locale/catalogs.json
	cd src/sentry && sentry django compilemessages

build-platform-assets:
	@echo "--> Building platform assets"
	sentry init
	@echo "from sentry.utils.integrationdocs import sync_docs; sync_docs(quiet=True)" | sentry exec

test-cli:
	@echo "--> Testing CLI"
	rm -rf test_cli
	mkdir test_cli
	cd test_cli && sentry init test_conf > /dev/null
	cd test_cli && sentry --config=test_conf upgrade --traceback --noinput > /dev/null
	cd test_cli && sentry --config=test_conf help 2>&1 | grep start > /dev/null
	rm -r test_cli
	@echo ""

test-js:
	@echo "--> Building static assets"
	@$(WEBPACK) --profile --json > webpack-stats.json
	@echo "--> Running JavaScript tests"
	@npm run test-ci
	@echo ""

# builds and creates percy snapshots
test-styleguide:
	@echo "--> Building and snapshotting styleguide"
	@npm run snapshot
	@echo ""

test-python: build-platform-assets
	@echo "--> Running Python tests"
	py.test tests/integration tests/sentry --cov . --cov-report="xml:coverage.xml" --junit-xml="junit.xml" || exit 1
	@echo ""

test-network:
	@echo "--> Building platform assets"
	sentry init
	@echo "from sentry.utils.integrationdocs import sync_docs; sync_docs(quiet=True)" | sentry exec
	@echo "--> Running network tests"
	py.test tests/network --cov . --cov-report="xml:coverage.xml" --junit-xml="junit.xml"
	@echo ""

test-snuba:
	@echo "--> Running snuba tests"
	py.test tests/snuba --cov . --cov-report="xml:coverage.xml" --junit-xml="junit.xml"
	@echo ""

test-acceptance: build-platform-assets
	@echo "--> Building static assets"
	@$(WEBPACK) --display errors-only
	@echo "--> Running acceptance tests"
	py.test tests/acceptance --cov . --cov-report="xml:coverage.xml" --junit-xml="junit.xml" --html="pytest.html"
	@echo ""

lint: lint-python lint-js

lint-python:
	@echo "--> Linting python"
	bash -eo pipefail -c "bin/lint --python --parseable | tee flake8.pycodestyle.log"
	@echo ""

lint-js:
	@echo "--> Linting javascript"
	bin/lint --js --parseable
	@echo ""

scan-python:
	@echo "--> Running Python vulnerability scanner"
	python -m pip install -q safety
	bin/scan
	@echo ""

publish:
	python setup.py sdist bdist_wheel upload


############################
# Halt, Travis stuff below #
############################

travis-noop:
	@echo "nothing to do here."

travis-setup-cassandra:
	echo "create keyspace sentry with replication = {'class' : 'SimpleStrategy', 'replication_factor': 1};" | cqlsh --cqlversion=3.1.7
	echo 'create table nodestore (key text primary key, value blob, flags int);' | cqlsh -k sentry --cqlversion=3.1.7

# Lint steps
travis-lint-sqlite: lint-python
travis-lint-postgres: lint-python
travis-lint-mysql: lint-python
travis-lint-acceptance: travis-noop
travis-lint-network: lint-python
travis-lint-snuba: lint-python
travis-lint-js: lint-js
travis-lint-cli: travis-noop
travis-lint-dist: travis-noop

# Test steps
travis-test-sqlite: test-python
travis-test-postgres: test-python
travis-test-mysql: test-python
travis-test-acceptance: test-acceptance
travis-test-network: test-network
travis-test-snuba: test-snuba
travis-test-js: test-js
travis-test-cli: test-cli
travis-test-dist:
	SENTRY_BUILD=$(TRAVIS_COMMIT) SENTRY_LIGHT_BUILD=0 python setup.py sdist bdist_wheel
	@ls -lh dist/

# Scan steps
travis-scan-sqlite: scan-python
travis-scan-postgres: scan-python
travis-scan-mysql: scan-python
travis-scan-acceptance: travis-noop
travis-scan-network: travis-noop
travis-scan-snuba: scan-python
travis-scan-js: travis-noop
travis-scan-cli: travis-noop
travis-scan-dist: travis-noop

.PHONY: all develop develop-only build dev-docs test testloop reset-db clean setup-git update-submodules install-system-pkgs install-yarn-pkgs install-sentry install-sentry-dev build-js-po locale update-transifex build-platform-assets test-cli test-js test-styleguide test-python test-network test-snuba test-acceptance lint lint-python lint-js scan-python coverage publish extract-api-docs travis-noop travis-setup-cassandra travis-lint-sqlite travis-lint-postgres travis-lint-mysql travis-lint-acceptance travis-lint-network travis-lint-snuba travis-lint-js travis-lint-cli travis-lint-dist travis-test-sqlite travis-test-postgres travis-test-mysql travis-test-acceptance travis-test-network travis-test-snuba travis-test-js travis-test-cli travis-test-dist travis-scan-sqlite travis-scan-postgres travis-scan-mysql travis-scan-acceptance travis-scan-network travis-scan-snuba travis-scan-js travis-scan-cli travis-scan-dist
