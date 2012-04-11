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
	lessc ${BOOTSTRAP_LESS} > ${GLOBAL_CSS};
	lessc ${BOOTSTRAP_LESS} > ${GLOBAL_CSS_MIN} --compress;
	cat sentry/static/scripts/sentry.core.js sentry/static/scripts/sentry.realtime.js sentry/static/scripts/sentry.charts.js sentry/static/scripts/sentry.notifications.js sentry/static/scripts/sentry.stream.js > ${GLOBAL_JS};
	cat bootstrap/js/bootstrap-alert.js bootstrap/js/bootstrap-dropdown.js bootstrap/js/bootstrap-tooltip.js bootstrap/js/bootstrap-tab.js bootstrap/js/bootstrap-buttons.js bootstrap/js/bootstrap-modal.js > ${BOOTSTRAP_JS};
	uglifyjs -nc ${GLOBAL_JS} > ${GLOBAL_JS_MIN};
	uglifyjs -nc ${BOOTSTRAP_JS} > ${BOOTSTRAP_JS_MIN};
	echo "Static assets successfully built! - `date`";

#
# Watch less files
#

watch:
	echo "Watching less files..."; \
	watchr -e "watch('bootstrap/less/.*\.less') { system 'make' }"

test:
	coverage run runtests.py --noinput --include=sentry/* && \
	coverage html --omit=*/migrations/* -d cover

.PHONY: build watch