VERSION = 2.0.0
NPM_ROOT = ./node_modules
STATIC_DIR = src/sentry/static/sentry
BOOTSTRAP_JS = ${STATIC_DIR}/scripts/lib/bootstrap.js
BOOTSTRAP_JS_MIN = ${STATIC_DIR}/scripts/lib/bootstrap.min.js
UGLIFY_JS ?= node_modules/uglify-js/bin/uglifyjs

JS_TESTS = tests/js/index.html
JS_REPORTER = dot

develop: update-submodules
	npm install -q
	# order matters here, base package must install first
	pip install -q -e . --use-mirrors
	pip install -q "file://`pwd`#egg=sentry[dev]" --use-mirrors
	pip install -q "file://`pwd`#egg=sentry[tests]" --use-mirrors
	make setup-git

dev-postgres:
	pip install -q -e . --use-mirrors
	pip install -q "file://`pwd`#egg=sentry[dev]" --use-mirrors
	pip install -q "file://`pwd`#egg=sentry[postgres]" --use-mirrors

dev-mysql:
	pip install -q -e . --use-mirrors
	pip install -q "file://`pwd`#egg=sentry[dev]" --use-mirrors
	pip install -q "file://`pwd`#egg=sentry[mysql]" --use-mirrors

dev-docs:
	pip install -q -r docs/requirements.txt --use-mirrors

setup-git:
	git config branch.autosetuprebase always
	cd .git/hooks && ln -sf ../../hooks/* ./

build: locale

clean:
	rm -r src/sentry/static/CACHE

locale:
	cd src/sentry && sentry makemessages -l en
	cd src/sentry && sentry compilemessages

update-transifex:
	pip install transifex-client
	tx push -s
	tx pull -a

compile-bootstrap-js:
	@cat src/bootstrap/js/bootstrap-transition.js src/bootstrap/js/bootstrap-alert.js src/bootstrap/js/bootstrap-button.js src/bootstrap/js/bootstrap-carousel.js src/bootstrap/js/bootstrap-collapse.js src/bootstrap/js/bootstrap-dropdown.js src/bootstrap/js/bootstrap-modal.js src/bootstrap/js/bootstrap-tooltip.js src/bootstrap/js/bootstrap-popover.js src/bootstrap/js/bootstrap-scrollspy.js src/bootstrap/js/bootstrap-tab.js src/bootstrap/js/bootstrap-typeahead.js src/bootstrap/js/bootstrap-affix.js ${STATIC_DIR}/scripts/bootstrap-datepicker.js > ${BOOTSTRAP_JS}
	${UGLIFY_JS} -nc ${BOOTSTRAP_JS} > ${BOOTSTRAP_JS_MIN};

update-submodules:
	git submodule init
	git submodule update

test: develop lint test-js test-python test-cli

testloop: develop
	pip install pytest-xdist --use-mirrors
	py.test tests -f

test-cli:
	@echo "Testing CLI"
	rm -rf test_cli
	mkdir test_cli
	cd test_cli && sentry init test.conf
	cd test_cli && sentry --config=test.conf upgrade --verbosity=0 --noinput
	cd test_cli && sentry --config=test.conf help | grep start > /dev/null
	rm -r test_cli

test-js:
	@echo "Running JavaScript tests"
	${NPM_ROOT}/.bin/mocha-phantomjs -p ${NPM_ROOT}/phantomjs/bin/phantomjs -R ${JS_REPORTER} ${JS_TESTS}
	@echo ""

test-python:
	@echo "Running Python tests"
	python setup.py -q test || exit 1
	@echo ""

lint: lint-python lint-js

lint-python:
	@echo "Linting Python files"
	PYFLAKES_NODOCTEST=1 flake8 src/sentry
	@echo ""

lint-js:
	@echo "Linting JavaScript files"
	@${NPM_ROOT}/.bin/jshint src/sentry/ || exit 1
	@echo ""

coverage: develop
	py.test --cov=src/sentry --cov-report=html

run-uwsgi:
	uwsgi --http 127.0.0.1:8000 --need-app --disable-logging --wsgi-file src/sentry/wsgi.py --processes 1 --threads 5

.PHONY: build
