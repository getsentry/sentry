VERSION = 2.0.0
NPM_ROOT = node_modules/
STATIC_DIR = src/sentry/static/sentry
BOOTSTRAP_JS = ${STATIC_DIR}/scripts/bootstrap.js
BOOTSTRAP_JS_MIN = ${STATIC_DIR}/scripts/bootstrap.min.js
GLOBAL_JS = ${STATIC_DIR}/scripts/global.js
GLOBAL_JS_MIN = ${STATIC_DIR}/scripts/global.min.js
UGLIFY_JS ?= `which uglifyjs`
COFFEE ?= `which coffee`
WATCHR ?= `which watchr`

develop: update-submodules
	npm install
	pip install "flake8>=1.6" --use-mirrors
	pip install -e . --use-mirrors

build: static coffee locale

clean:
	rm -r src/sentry/static/CACHE

locale:
	cd src/sentry && sentry makemessages -l en
	cd src/sentry && sentry compilemessages

static:
	@cat src/bootstrap/js/bootstrap-transition.js src/bootstrap/js/bootstrap-alert.js src/bootstrap/js/bootstrap-button.js src/bootstrap/js/bootstrap-carousel.js src/bootstrap/js/bootstrap-collapse.js src/bootstrap/js/bootstrap-dropdown.js src/bootstrap/js/bootstrap-modal.js src/bootstrap/js/bootstrap-tooltip.js src/bootstrap/js/bootstrap-popover.js src/bootstrap/js/bootstrap-scrollspy.js src/bootstrap/js/bootstrap-tab.js src/bootstrap/js/bootstrap-typeahead.js src/bootstrap/js/bootstrap-affix.js ${STATIC_DIR}/scripts/bootstrap-datepicker.js > ${BOOTSTRAP_JS}
	@uglifyjs -nc ${BOOTSTRAP_JS} > ${BOOTSTRAP_JS_MIN};
	@echo "Static assets successfully built! - `date`";

update-submodules:
	git submodule init
	git submodule update

coffee:
	@${NPM_ROOT}/coffee-script/bin/coffee --join ${STATIC_DIR}/scripts/site.js -c ${STATIC_DIR}/coffee/*.coffee
	@echo "Coffe script assets successfully built! - `date`";

cwatch:
	@echo "Watching coffee script files..."; \
	make coffee
	@${NPM_ROOT}/coffee-script/bin/coffee --join ${STATIC_DIR}/scripts/site.js -cw ${STATIC_DIR}/coffee/*.coffee

test: lint test-js test-python

test-js:
	@echo "Running JavaScript tests"
	@${NPM_ROOT}/phantomjs/bin/phantomjs runtests.coffee tests/js/index.html || exit 1
	@echo ""

test-python:
	@echo "Running Python tests"
	python setup.py -q test || exit 1
	@echo ""

lint: lint-python

lint-python:
	@echo "Linting Python files"
	flake8 --exclude=migrations --ignore=E501,E225,E121,E123,E124,E125,E127,E128 --exit-zero src/sentry || exit 1
	@echo ""

coverage:
	cd src && coverage run --include=sentry/* setup.py test && \
	coverage html --omit=*/migrations/* -d cover


.PHONY: build watch coffee
