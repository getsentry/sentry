VERSION=2.0.0
GLOBAL_CSS = sentry/static/styles/global.css
GLOBAL_CSS_MIN = sentry/static/styles/global.min.css
BOOTSTRAP_JS = sentry/static/scripts/bootstrap.js
BOOTSTRAP_JS_MIN = sentry/static/scripts/bootstrap.min.js
GLOBAL_JS = sentry/static/scripts/global.js
GLOBAL_JS_MIN = sentry/static/scripts/global.min.js
BOOTSTRAP_LESS = bootstrap/sentry.less
LESS_COMPRESSOR ?= `which lessc`
UGLIFY_JS ?= `which uglifyjs`
WATCHR ?= `which watchr`

build: static locale

#
# Compile language files
#

locale:
	cd sentry && sentry makemessages -l en
	cd sentry && sentry compilemessages

#
# Build less files
#

static:
	@lessc ${BOOTSTRAP_LESS} > ${GLOBAL_CSS};
	@lessc ${BOOTSTRAP_LESS} > ${GLOBAL_CSS_MIN} --compress;
	@cat sentry/static/scripts/sentry.core.js sentry/static/scripts/sentry.realtime.js sentry/static/scripts/sentry.charts.js sentry/static/scripts/sentry.notifications.js sentry/static/scripts/sentry.stream.js > ${GLOBAL_JS};
	@cat bootstrap/js/bootstrap-alert.js bootstrap/js/bootstrap-dropdown.js bootstrap/js/bootstrap-tooltip.js bootstrap/js/bootstrap-tab.js bootstrap/js/bootstrap-buttons.js bootstrap/js/bootstrap-modal.js sentry/static/scripts/bootstrap-datepicker.js > ${BOOTSTRAP_JS};
	@uglifyjs -nc ${GLOBAL_JS} > ${GLOBAL_JS_MIN};
	@uglifyjs -nc ${BOOTSTRAP_JS} > ${BOOTSTRAP_JS_MIN};
	@echo "Static assets successfully built! - `date`";

#
# Watch less files
#

watch:
	@echo "Watching less files..."; \
	make static; \
	watchr -e "watch('bootstrap/.*\.less') { system 'make static' }"

test:
	pep8 --exclude=migrations --ignore=E501,E225 sentry || exit 1
	pyflakes -x W sentry || exit 1
	coverage run --include=sentry/* setup.py test && \
	coverage html --omit=*/migrations/* -d cover

.PHONY: build watch