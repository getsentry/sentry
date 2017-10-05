CPUS ?= $(shell sysctl -n hw.ncpu 2> /dev/null || echo 1)
MAKEFLAGS += --jobs=$(CPUS)
NPM_ROOT = ./node_modules
STATIC_DIR = src/sentry/static/sentry

ifneq "$(wildcard /usr/local/opt/libxmlsec1/lib)" ""
	LDFLAGS += -L/usr/local/opt/libxmlsec1/lib
endif
ifneq "$(wildcard /usr/local/opt/openssl/lib)" ""
	LDFLAGS += -L/usr/local/opt/openssl/lib
endif

PIP = LDFLAGS="$(LDFLAGS)" pip

develop-only: update-submodules install-brew install-python install-yarn

develop: setup-git develop-only
	@echo ""

install-yarn:
	@echo "--> Installing Node dependencies"
	@hash yarn 2> /dev/null || (echo 'Cannot continue with JavaScript dependencies. Please install yarn before proceeding. For more information refer to https://yarnpkg.com/lang/en/docs/install/'; echo 'If you are on a mac run:'; echo '  brew install yarn'; exit 1)
	# Use NODE_ENV=development so that yarn installs both dependencies + devDependencies
	NODE_ENV=development yarn install --ignore-optional --pure-lockfile
	# Fix phantomjs-prebuilt not installed via yarn
	# See: https://github.com/karma-runner/karma-phantomjs-launcher/issues/120#issuecomment-262634703
	node ./node_modules/phantomjs-prebuilt/install.js

install-brew:
	@hash brew 2> /dev/null && brew bundle || (echo '! Homebrew not found, skipping system dependencies.')

install-python:
	# must be executed serialially
	$(MAKE) install-python-base
	$(MAKE) install-python-develop

install-python-base:
	@echo "--> Installing Python dependencies"
	$(PIP) install "setuptools>=0.9.8" "pip>=8.0.0"
	# order matters here, base package must install first
	$(PIP) install -e .
	$(PIP) install ujson
	$(PIP) install "file://`pwd`#egg=sentry[dev]"

install-python-develop:
	$(PIP) install "file://`pwd`#egg=sentry[dev,tests]"

install-python-tests:
	$(PIP) install "file://`pwd`#egg=sentry[dev,tests,optional]"

dev-postgres: install-python

dev-docs:
	$(PIP) install -r doc-requirements.txt

reset-db:
	@echo "--> Dropping existing 'sentry' database"
	dropdb sentry || true
	@echo "--> Creating 'sentry' database"
	createdb -E utf-8 sentry
	@echo "--> Applying migrations"
	sentry upgrade

setup-git:
	@echo "--> Installing git hooks"
	git config branch.autosetuprebase always
	cd .git/hooks && ln -sf ../../config/hooks/* ./
	@echo ""

build: locale

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

build-js-po:
	mkdir -p build
	SENTRY_EXTRACT_TRANSLATIONS=1 ./node_modules/.bin/webpack

locale: build-js-po
	cd src/sentry && sentry django makemessages -i static -l en
	./bin/merge-catalogs en
	./bin/find-good-catalogs src/sentry/locale/catalogs.json
	cd src/sentry && sentry django compilemessages

update-transifex: build-js-po
	pip install transifex-client
	cd src/sentry && sentry django makemessages -i static -l en
	./bin/merge-catalogs en
	tx push -s
	tx pull -a
	./bin/find-good-catalogs src/sentry/locale/catalogs.json
	cd src/sentry && sentry django compilemessages

update-submodules:
	@echo "--> Updating git submodules"
	git submodule init
	git submodule update
	@echo ""

build-platform-assets:
	@echo "--> Building platform assets"
	sentry init
	@echo "from sentry.utils.integrationdocs import sync_docs; sync_docs()" | sentry exec

test: develop lint test-js test-python test-cli

testloop: develop
	pip install pytest-xdist
	py.test tests -f

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
	@${NPM_ROOT}/.bin/webpack
	@echo "--> Running JavaScript tests"
	@npm run test-ci
	@npm run snapshot
	@echo ""

test-python: build-platform-assets
	@echo "--> Running Python tests"
	py.test tests/integration tests/sentry --cov . --cov-report="xml:coverage.xml" --junit-xml="junit.xml" || exit 1
	@echo ""

test-network:
	@echo "--> Building platform assets"
	sentry init
	@echo "from sentry.utils.integrationdocs import sync_docs; sync_docs()" | sentry exec
	@echo "--> Running network tests"
	py.test tests/network --cov . --cov-report="xml:coverage.xml" --junit-xml="junit.xml"
	@echo ""

test-acceptance: build-platform-assets
	@echo "--> Building static assets"
	@${NPM_ROOT}/.bin/webpack
	@echo "--> Running acceptance tests"
	py.test tests/acceptance --cov . --cov-report="xml:coverage.xml" --junit-xml="junit.xml" --html="pytest.html"
	@echo ""

test-python-coverage: build-platform-assets
	@echo "--> Running Python tests"
	SOUTH_TESTS_MIGRATE=1 coverage run --source=src/sentry -m py.test tests/integration tests/sentry
	@echo ""

lint: lint-python lint-js

lint-python:
	@echo "--> Linting python"
	bin/lint --python
	@echo ""

lint-js:
	@echo "--> Linting javascript"
	bin/lint --js
	@echo ""

coverage: develop
	$(MAKE) test-python-coverage
	coverage html

publish:
	python setup.py sdist bdist_wheel upload

extract-api-docs:
	rm -rf api-docs/cache/*
	cd api-docs; python generator.py


.PHONY: develop dev-postgres dev-docs setup-git build clean locale update-transifex update-submodules test testloop test-cli test-js test-python test-acceptance test-python-coverage lint lint-python lint-js coverage publish


############################
# Halt, Travis stuff below #
############################

# Bases for all builds
travis-upgrade-pip:
	python -m pip install "pip>=9,<10"
travis-setup-cassandra:
	echo "create keyspace sentry with replication = {'class' : 'SimpleStrategy', 'replication_factor': 1};" | cqlsh --cqlversion=3.1.7
	echo 'create table nodestore (key text primary key, value blob, flags int);' | cqlsh -k sentry --cqlversion=3.1.7
travis-install-python:
	$(MAKE) travis-upgrade-pip
	$(MAKE) install-python-base
	$(MAKE) install-python-tests
	python -m pip install codecov
travis-noop:
	@echo "nothing to do here."

.PHONY: travis-upgrade-pip travis-setup-cassandra travis-install-python travis-noop

travis-install-danger:
	bundle install
travis-install-sqlite: travis-install-python
travis-install-postgres: travis-install-python dev-postgres
	psql -c 'create database sentry;' -U postgres
travis-install-mysql: travis-install-python
	pip install mysqlclient
	echo 'create database sentry;' | mysql -uroot
travis-install-acceptance: install-yarn travis-install-postgres
travis-install-network: travis-install-postgres
travis-install-js:
	$(MAKE) travis-upgrade-pip
	$(MAKE) travis-install-python install-yarn
travis-install-cli: travis-install-postgres
travis-install-dist:
	$(MAKE) travis-upgrade-pip
	$(MAKE) travis-install-python install-yarn
travis-install-django-18: travis-install-postgres
	pip install "Django>=1.8,<1.9"

.PHONY: travis-install-danger travis-install-sqlite travis-install-postgres travis-install-js travis-install-cli travis-install-dist

# Lint steps
travis-lint-danger: travis-noop
travis-lint-sqlite: lint-python
travis-lint-postgres: lint-python
travis-lint-mysql: lint-python
travis-lint-acceptance: travis-noop
travis-lint-network: lint-python
travis-lint-js: lint-js
travis-lint-cli: travis-noop
travis-lint-dist: travis-noop
travis-lint-django-18: travis-lint-postgres

.PHONY: travis-lint-danger travis-lint-sqlite travis-lint-postgres travis-lint-mysql travis-lint-js travis-lint-cli travis-lint-dist

# Test steps
travis-test-danger:
	bundle exec danger
travis-test-sqlite: test-python-coverage
travis-test-postgres: test-python-coverage
travis-test-mysql: test-python-coverage
travis-test-acceptance: test-acceptance
travis-test-network: test-network
travis-test-js: test-js
travis-test-cli: test-cli
travis-test-dist:
	SENTRY_BUILD=$(TRAVIS_COMMIT) SENTRY_LIGHT_BUILD=0 python setup.py sdist bdist_wheel
	@ls -lh dist/
travis-test-django-18: travis-test-postgres

.PHONY: travis-test-danger travis-test-sqlite travis-test-postgres travis-test-mysql travis-test-js travis-test-cli travis-test-dist
