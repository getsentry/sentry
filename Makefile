NPM_ROOT = ./node_modules
STATIC_DIR = src/sentry/static/sentry

install-python:
	@echo "--> Installing Python dependencies"
	pip install "setuptools>=0.9.8"
	# order matters here, base package must install first
	pip install -e .
	pip install ujson
	pip install "file://`pwd`#egg=sentry[dev]"

install-npm:
	@echo "--> Installing Node dependencies"
	npm install

install-python-tests:
	pip install "file://`pwd`#egg=sentry[dev,tests,dsym]"

develop-only: update-submodules install-python install-python-tests install-npm

develop: update-submodules setup-git develop-only install-python-tests
	@echo ""

dev-postgres: install-python

dev-docs:
	pip install -r doc-requirements.txt

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
	rm -f dist/* static/dist/*
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
	@${NPM_ROOT}/.bin/webpack -p
	@echo "--> Running JavaScript tests"
	@npm run test
	@echo ""

test-python:
	@echo "--> Running Python tests"
	py.test tests/integration tests/sentry || exit 1
	@echo ""

test-acceptance:
	@echo "--> Building static assets"
	@${NPM_ROOT}/.bin/webpack -p
	@echo "--> Running acceptance tests"
	py.test tests/acceptance
	@echo ""

test-python-coverage:
	@echo "--> Running Python tests"
	coverage run --source=src/sentry -m py.test tests/integration tests/sentry
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
	make test-python-coverage
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
	python -m pip install pip==8.1.1
travis-setup-cassandra:
	echo "create keyspace sentry with replication = {'class' : 'SimpleStrategy', 'replication_factor': 1};" | cqlsh --cqlversion=3.1.7
	echo 'create table nodestore (key text primary key, value blob, flags int);' | cqlsh -k sentry --cqlversion=3.1.7
travis-install-python: travis-upgrade-pip install-python install-python-tests
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
travis-install-acceptance: install-npm travis-install-postgres
travis-install-js: travis-upgrade-pip install-python install-python-tests install-npm
travis-install-cli: travis-install-postgres
travis-install-dist: travis-upgrade-pip install-python install-python-tests

.PHONY: travis-install-danger travis-install-sqlite travis-install-postgres travis-install-js travis-install-cli travis-install-dist

# Lint steps
travis-lint-danger: travis-noop
travis-lint-sqlite: lint-python
travis-lint-postgres: lint-python
travis-lint-mysql: lint-python
travis-lint-acceptance: travis-noop
travis-lint-js: lint-js
travis-lint-cli: travis-noop
travis-lint-dist: travis-noop

.PHONY: travis-lint-danger travis-lint-sqlite travis-lint-postgres travis-lint-mysql travis-lint-js travis-lint-cli travis-lint-dist

# Test steps
travis-test-danger:
	bundle exec danger
travis-test-sqlite: test-python-coverage
travis-test-postgres: test-python-coverage
travis-test-mysql: test-python-coverage
travis-test-acceptance: test-acceptance
travis-test-js: test-js
travis-test-cli: test-cli
travis-test-dist:
	SENTRY_BUILD=$(TRAVIS_COMMIT) SENTRY_LIGHT_BUILD=0 python setup.py sdist bdist_wheel
	@ls -lh dist/

.PHONY: travis-test-danger travis-test-sqlite travis-test-postgres travis-test-mysql travis-test-js travis-test-cli travis-test-dist
