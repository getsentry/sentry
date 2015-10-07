NPM_ROOT = ./node_modules
STATIC_DIR = src/sentry/static/sentry

install-python:
	@echo "--> Installing Pythond dependencies"
	pip install "setuptools>=0.9.8"
	# order matters here, base package must install first
	pip install -e .
	pip install "file://`pwd`#egg=sentry[dev]"

install-npm:
	@echo "--> Installing Node dependencies"
	npm install

install-python-tests:
	pip install "file://`pwd`#egg=sentry[tests]"

develop-only: update-submodules install-python install-npm

develop: update-submodules setup-git develop-only install-python-tests
	@echo ""

dev-postgres: install-python
	pip install "file://`pwd`#egg=sentry[postgres]"

dev-mysql: install-python
	pip install "file://`pwd`#egg=sentry[mysql]"

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
	rm dist/*
	@echo "--> Cleaning pyc files"
	find . -name "*.pyc" -delete
	@echo ""

locale:
	cd src/sentry && sentry makemessages -i static -l en
	cd src/sentry && sentry compilemessages

update-transifex:
	pip install transifex-client
	cd src/sentry && sentry makemessages -i static -l en
	tx push -s
	tx pull -a
	cd src/sentry && sentry compilemessages

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
	cd test_cli && sentry init test.conf > /dev/null
	cd test_cli && sentry --config=test.conf upgrade --traceback --noinput > /dev/null
	cd test_cli && sentry --config=test.conf help 2>&1 | grep start > /dev/null
	rm -r test_cli
	@echo ""

test-js:
	@echo "--> Running JavaScript tests"
	@node_modules/.bin/webpack
	@npm run test
	@echo ""

test-python:
	@echo "--> Running Python tests"
	py.test tests || exit 1
	@echo ""

travis-test-python:
	@echo "--> Running Python tests"
	coverage run --source=src/sentry -m py.test tests
	@echo ""

test-postgres: travis-test-python
test-mysql: travis-test-python
test-sqlite: travis-test-python

lint:
	@echo "--> Linting all the things"
	bin/lint src/sentry tests
	@echo ""

# These are just aliases for backwards compat
# our linter does both now
lint-sqlite: lint-python
lint-mysql: lint-python
lint-postgres: lint-python
lint-python: lint
lint-js: lint
lint-cli:
	@echo "Nothing to lint :("

coverage: develop
	coverage run --source=src/sentry -m py.test
	coverage html

run-uwsgi:
	uwsgi --http 127.0.0.1:8000 --need-app --disable-logging --wsgi-file src/sentry/wsgi.py --processes 1 --threads 5

publish:
	python setup.py sdist bdist_wheel upload

extract-api-docs:
	rm -rf api-docs/cache/*
	cd api-docs; python generator.py

travis-upgrade-pip:
	python -m pip install --upgrade pip==7.1.2

travis-install-cassandra:
	echo "create keyspace sentry with replication = {'class' : 'SimpleStrategy', 'replication_factor': 1};" | cqlsh --cqlversion=3.0.3
	echo 'create table nodestore (key text primary key, value blob, flags int);' | cqlsh -k sentry --cqlversion=3.0.3

travis-install-python: travis-upgrade-pip install-python travis-install-cassandra
travis-install-sqlite: travis-install-python

travis-install-postgres: travis-install-python dev-postgres
	psql -c 'create database sentry;' -U postgres

travis-install-mysql: travis-install-python dev-mysql
	mysql -e 'create database sentry;'

travis-install-js:
	npm install --ignore-scripts

travis-install-cli: travis-install-python

.PHONY: develop dev-postgres dev-mysql dev-docs setup-git build clean locale update-transifex update-submodules test testloop test-cli test-js test-python lint lint-python lint-js coverage run-uwsgi publish
