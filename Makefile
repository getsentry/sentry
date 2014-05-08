VERSION = 2.0.0
NPM_ROOT = ./node_modules
STATIC_DIR = src/sentry/static/sentry
BOOTSTRAP_JS = ${STATIC_DIR}/scripts/lib/bootstrap.js
BOOTSTRAP_JS_MIN = ${STATIC_DIR}/scripts/lib/bootstrap.min.js
UGLIFY_JS ?= node_modules/uglify-js/bin/uglifyjs

JS_TESTS = tests/js/index.html
JS_REPORTER = dot

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

setup-git:
	@echo "--> Installing git hooks"
	git config branch.autosetuprebase always
	cd .git/hooks && ln -sf ../../hooks/* ./
	@echo ""

build: locale

clean:
	rm -r src/sentry/static/CACHE

locale:
	cd src/sentry && sentry makemessages -i static -l en
	cd src/sentry && sentry compilemessages

update-transifex:
	pip install transifex-client
	tx push -s
	tx pull -a

compile-bootstrap-js:
	@cat src/bootstrap/js/bootstrap-transition.js src/bootstrap/js/bootstrap-alert.js src/bootstrap/js/bootstrap-button.js src/bootstrap/js/bootstrap-carousel.js src/bootstrap/js/bootstrap-collapse.js src/bootstrap/js/bootstrap-dropdown.js src/bootstrap/js/bootstrap-modal.js src/bootstrap/js/bootstrap-tooltip.js src/bootstrap/js/bootstrap-popover.js src/bootstrap/js/bootstrap-scrollspy.js src/bootstrap/js/bootstrap-tab.js src/bootstrap/js/bootstrap-typeahead.js src/bootstrap/js/bootstrap-affix.js ${STATIC_DIR}/scripts/bootstrap-datepicker.js > ${BOOTSTRAP_JS}
	${UGLIFY_JS} -nc ${BOOTSTRAP_JS} > ${BOOTSTRAP_JS_MIN};

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
	${NPM_ROOT}/.bin/mocha-phantomjs -p ${NPM_ROOT}/phantomjs/bin/phantomjs -R ${JS_REPORTER} ${JS_TESTS}
	@echo ""

test-python:
	@echo "--> Running Python tests"
	py.test tests || exit 1
	@echo ""

lint: lint-python lint-js

lint-python:
	@echo "--> Linting Python files"
	PYFLAKES_NODOCTEST=1 flake8 src/sentry
	@echo ""

lint-js:
	@echo "--> Linting JavaScript files"
	${NPM_ROOT}/.bin/jshint src/sentry/ || exit 1
	@echo ""

coverage: develop
	py.test --cov=src/sentry --cov-report=html

run-uwsgi:
	uwsgi --http 127.0.0.1:8000 --need-app --disable-logging --wsgi-file src/sentry/wsgi.py --processes 1 --threads 5

publish:
	python setup.py sdist bdist_wheel upload

.PHONY: develop dev-postgres dev-mysql dev-docs setup-git build clean locale update-transifex compile-bootstrap-js update-submodules test testloop test-cli test-js test-python lint lint-python lint-js coverage run-uwsgi publish
