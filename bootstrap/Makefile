VERSION=2.0.0
BOOTSTRAP = ../sentry/static/styles/global.css
BOOTSTRAP_MIN = ../sentry/static/styles/global.min.css
BOOTSTRAP_JS = ../sentry/static/scripts/bootstrap.js
BOOTSTRAP_JS_MIN = ../sentry/static/scripts/bootstrap.min.js
BOOTSTRAP_LESS = ./sentry.less
LESS_COMPRESSOR ?= `which lessc`
UGLIFY_JS ?= `which uglifyjs`
WATCHR ?= `which watchr`

#
# Build less files
#

build:
	lessc ${BOOTSTRAP_LESS} > ${BOOTSTRAP};
	lessc ${BOOTSTRAP_LESS} > ${BOOTSTRAP_MIN} --compress;
	cat js/bootstrap-alert.js js/bootstrap-dropdown.js js/bootstrap-tooltip.js js/bootstrap-tab.js > ${BOOTSTRAP_JS};
	uglifyjs -nc ${BOOTSTRAP_JS} > ${BOOTSTRAP_JS_MIN};
	echo "Bootstrap successfully built! - `date`";

#
# Watch less files
#

watch:
	echo "Watching less files..."; \
	watchr -e "watch('less/.*\.less') { system 'make' }"

.PHONY: build watch