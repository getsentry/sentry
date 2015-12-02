NPM_ROOT = ./node_modules
STATIC_DIR = src/sentry/static/sentry

install-python:
	@echo "--> Installing Python dependencies"
	pip install "setuptools>=0.9.8"
	# order matters here, base package must install first
	pip install -e .
	pip install "file://`pwd`#egg=sentry[dev]"

install-npm:
	@echo "--> Installing Node dependencies"
	npm install

install-python-tests:
	pip install "file://`pwd`#egg=sentry[tests]"

develop-only: update-submodules install-python install-python-tests install-npm

develop: update-submodules setup-git develop-only install-python-tests
	@echo ""

dev-postgres: install-python
	pip install "file://`pwd`#egg=sentry[postgres]"

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
	cd .git/hooks && ln -sf ../../hooks/* ./
	@echo ""

build: locale

clean:
	@echo "--> Cleaning static cache"
	rm dist/* static/dist/*
	@echo "--> Cleaning pyc files"
	find . -name "*.pyc" -delete
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
	@echo "--> Running JavaScript tests"
	@${NPM_ROOT}/.bin/webpack
	@npm run test
	@echo ""

test-python:
	@echo "--> Running Python tests"
	py.test tests || exit 1
	@echo ""


test-python-coverage:
	@echo "--> Running Python tests"
	coverage run --source=src/sentry,tests -m py.test tests
	@echo ""


lint:
	@echo "--> Linting all the things"
	bin/lint
	@echo ""

# These are just aliases for backwards compat
# our linter does both now
lint-python: lint
lint-js: lint

coverage: develop
	make test-python-coverage
	coverage html

run-uwsgi:
	uwsgi --http 127.0.0.1:8000 --need-app --disable-logging --wsgi-file src/sentry/wsgi.py --processes 1 --threads 5

publish:
	python setup.py sdist bdist_wheel upload

extract-api-docs:
	rm -rf api-docs/cache/*
	cd api-docs; python generator.py


.PHONY: develop dev-postgres dev-docs setup-git build clean locale update-transifex update-submodules test testloop test-cli test-js test-python test-python-coverage lint lint-python lint-js coverage run-uwsgi publish


############################
# Halt, Travis stuff below #
############################

# Bases for all builds
travis-upgrade-pip:
	python -m pip install --upgrade pip==7.1.2
travis-setup-cassandra:
	echo "create keyspace sentry with replication = {'class' : 'SimpleStrategy', 'replication_factor': 1};" | cqlsh --cqlversion=3.0.3
	echo 'create table nodestore (key text primary key, value blob, flags int);' | cqlsh -k sentry --cqlversion=3.0.3
travis-install-python: travis-upgrade-pip install-python-tests travis-setup-cassandra
	python -m pip install codecov
travis-noop:
	@echo "nothing to do here."

.PHONY: travis-upgrade-pip travis-setup-cassandra travis-install-python travis-noop

# Install steps
travis-install-sqlite: travis-install-python
travis-install-postgres: travis-install-python dev-postgres
	psql -c 'create database sentry;' -U postgres
travis-install-webpack: travis-install-js
travis-install-js: install-npm
travis-install-cli: travis-install-python

.PHONY: travis-install-sqlite travis-install-postgres travis-install-webpack travis-install-js travis-install-cli

# Lint steps
travis-lint-sqlite: lint
travis-lint-postgres: lint
travis-lint-webpack: travis-noop
travis-lint-js: lint
travis-lint-cli: travis-noop

.PHONY: travis-lint-sqlite travis-lint-postgres travis-lint-webpack travis-lint-js travis-lint-cli

# Test steps
travis-test-sqlite: test-python-coverage
travis-test-postgres: test-python-coverage
travis-test-webpack:
	@echo "--> Compiling webpack"
	${NPM_ROOT}/.bin/webpack
travis-test-js: test-js
travis-test-ci: test-ci

.PHONY: travis-test-sqlite travis-test-postgres travis-test-webpack travis-test-js travis-test-cli
