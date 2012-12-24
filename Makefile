VERSION = 2.0.0
NPM_ROOT = node_modules
STATIC_DIR = src/sentry/static/sentry
BOOTSTRAP_JS = ${STATIC_DIR}/scripts/lib/bootstrap.js
BOOTSTRAP_JS_MIN = ${STATIC_DIR}/scripts/lib/bootstrap.min.js
UGLIFY_JS ?= node_modules/uglify-js/bin/uglifyjs
LESS = node_modules/less/bin/lessc

develop: update-submodules
	npm install
	pip install "flake8>=1.6" --use-mirrors
	pip install -e . --use-mirrors

build: static locale

clean:
	rm -r src/sentry/static/CACHE

locale:
	cd src/sentry && sentry makemessages -l en
	cd src/sentry && sentry compilemessages

compile-bootstrap-js:
	@cat src/bootstrap/js/bootstrap-transition.js src/bootstrap/js/bootstrap-alert.js src/bootstrap/js/bootstrap-button.js src/bootstrap/js/bootstrap-carousel.js src/bootstrap/js/bootstrap-collapse.js src/bootstrap/js/bootstrap-dropdown.js src/bootstrap/js/bootstrap-modal.js src/bootstrap/js/bootstrap-tooltip.js src/bootstrap/js/bootstrap-popover.js src/bootstrap/js/bootstrap-scrollspy.js src/bootstrap/js/bootstrap-tab.js src/bootstrap/js/bootstrap-typeahead.js src/bootstrap/js/bootstrap-affix.js ${STATIC_DIR}/scripts/bootstrap-datepicker.js > ${BOOTSTRAP_JS}
	${UGLIFY_JS} -nc ${BOOTSTRAP_JS} > ${BOOTSTRAP_JS_MIN};


static:
	${LESS} --strict-imports ${STATIC_DIR}/less/sentry.less ${STATIC_DIR}/styles/sentry.css
	@echo "Static assets successfully built! - `date`";

update-submodules:
	git submodule init
	git submodule update

test: lint test-js test-python

test-js:
	@echo "Running JavaScript tests"
	${NPM_ROOT}/phantomjs/bin/phantomjs runtests.js tests/js/index.html
	@echo ""

test-python:
	@echo "Running Python tests"
	python setup.py -q test || exit 1
	@echo ""

lint: lint-python lint-js

lint-python:
	@echo "Linting Python files"
	flake8 --exclude=migrations --ignore=E501,E225,E121,E123,E124,E125,E127,E128 --exit-zero src/sentry || exit 1
	@echo ""

lint-js:
	@echo "Linting JavaScript files"
	@${NPM_ROOT}/jshint/bin/hint src/sentry/ || exit 1
	@echo ""

coverage:
	coverage run --include=src/sentry/* setup.py test
	coverage html --omit=src/sentry/migrations/* -d htmlcov


.PHONY: build
