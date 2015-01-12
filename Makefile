NPM_ROOT = ./node_modules
STATIC_DIR = src/sentry/static/sentry

develop: update-submodules setup-git
	@echo "--> Installing dependencies"
	npm install
	pip install "setuptools>=0.9.8"
	# order matters here, base package must install first
	pip install -e .
	pip install "file://`pwd`#egg=sentry[dev]"
	pip install "file://`pwd`#egg=sentry[tests]"
	@echo ""

dev-postgres: develop
	pip install "file://`pwd`#egg=sentry[postgres]"

dev-mysql: develop
	pip install "file://`pwd`#egg=sentry[mysql]"

dev-docs:
	pip install -r docs/requirements.txt

reset-db:
	@echo "--> Dropping existing 'sentry' database"
	dropdb sentry || true
	@echo "--> Creating 'sentry' database"
	createdb -E utf-8 sentry
	@echo "--> Applying migrations"
	sentry upgrade
	@echo "--> Creating default user"
	sentry createuser

setup-git:
	@echo "--> Installing git hooks"
	git config branch.autosetuprebase always
	cd .git/hooks && ln -sf ../../hooks/* ./
	@echo ""

build: locale

clean:
	@echo "--> Cleaning static cache"
	${NPM_ROOT}/.bin/gulp clean
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
	cd test_cli && sentry --config=test.conf help | grep start > /dev/null
	rm -r test_cli
	@echo ""

test-js:
	@echo "--> Running JavaScript tests"
	npm test
	@echo ""

test-python:
	@echo "--> Running Python tests"
	py.test tests || exit 1
	@echo ""

lint: lint-python lint-js

lint-python:
	@echo "--> Linting Python files"
	PYFLAKES_NODOCTEST=1 flake8 src/sentry tests
	@echo ""

lint-js:
	@echo "--> Linting JavaScript files"
	npm run lint
	@echo ""

coverage: develop
	coverage run --source=src/sentry -m py.test
	coverage html

run-uwsgi:
	uwsgi --http 127.0.0.1:8000 --need-app --disable-logging --wsgi-file src/sentry/wsgi.py --processes 1 --threads 5

publish:
	python setup.py sdist bdist_wheel upload

.PHONY: develop dev-postgres dev-mysql dev-docs setup-git build clean locale update-transifex update-submodules test testloop test-cli test-js test-python lint lint-python lint-js coverage run-uwsgi publish
