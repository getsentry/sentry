VERSION = 2.0.0
STATIC_DIR = src/sentry/static/sentry
GLOBAL_CSS = ${STATIC_DIR}/styles/global.css
GLOBAL_CSS_MIN = ${STATIC_DIR}/styles/global.min.css
BOOTSTRAP_JS = ${STATIC_DIR}/scripts/bootstrap.js
BOOTSTRAP_JS_MIN = ${STATIC_DIR}/scripts/bootstrap.min.js
GLOBAL_JS = ${STATIC_DIR}/scripts/global.js
GLOBAL_JS_MIN = ${STATIC_DIR}/scripts/global.min.js
BOOTSTRAP_LESS = src/sentry.less
LESS_COMPRESSOR ?= `which lessc`
UGLIFY_JS ?= `which uglifyjs`
COFFEE ?= `which coffee`
WATCHR ?= `which watchr`

build: static coffee locale

#
# Compile language files
#

locale:
	cd src/sentry && sentry makemessages -l en
	cd src/sentry && sentry compilemessages

#
# Build less files
#

static:
	@lessc ${BOOTSTRAP_LESS} > ${GLOBAL_CSS};
	@lessc ${BOOTSTRAP_LESS} > ${GLOBAL_CSS_MIN} --compress;
	@cat ${STATIC_DIR}/scripts/sentry.core.js ${STATIC_DIR}/scripts/sentry.realtime.js ${STATIC_DIR}/scripts/sentry.charts.js ${STATIC_DIR}/scripts/sentry.notifications.js ${STATIC_DIR}/scripts/sentry.stream.js > ${GLOBAL_JS};
	@cat src/bootstrap/js/bootstrap-transition.js src/bootstrap/js/bootstrap-alert.js src/bootstrap/js/bootstrap-button.js src/bootstrap/js/bootstrap-carousel.js src/bootstrap/js/bootstrap-collapse.js src/bootstrap/js/bootstrap-dropdown.js src/bootstrap/js/bootstrap-modal.js src/bootstrap/js/bootstrap-tooltip.js src/bootstrap/js/bootstrap-popover.js src/bootstrap/js/bootstrap-scrollspy.js src/bootstrap/js/bootstrap-tab.js src/bootstrap/js/bootstrap-typeahead.js src/bootstrap/js/bootstrap-affix.js ${STATIC_DIR}/scripts/bootstrap-datepicker.js > ${BOOTSTRAP_JS}
	@uglifyjs -nc ${GLOBAL_JS} > ${GLOBAL_JS_MIN};
	@uglifyjs -nc ${BOOTSTRAP_JS} > ${BOOTSTRAP_JS_MIN};
	@echo "Static assets successfully built! - `date`";


coffee:
	@coffee --join ${STATIC_DIR}/scripts/site.js -c ${STATIC_DIR}/coffee/*.coffee
	@echo "Coffe script assets successfully built! - `date`";
#
# Watch less files
#

watch:
	@echo "Watching less files..."; \
	make static; \
	watchr -e "watch('src/sentry.less') { system 'make static' }"

cwatch:
	@echo "Watching coffee script files..."; \
	make coffee
	coffee --join ${STATIC_DIR}/scripts/site.js -cw ${STATIC_DIR}/coffee/*.coffee


test:
	pip install flake8 --use-mirrors
	cd src && flake8 --exclude=migrations --ignore=E501,E225,E121,E123,E124,E125,E127,E128 --exit-zero sentry || exit 1
	python setup.py test

coverage:
	cd src && coverage run --include=sentry/* setup.py test && \
	coverage html --omit=*/migrations/* -d cover


.PHONY: build watch coffee