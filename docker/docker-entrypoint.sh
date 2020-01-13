#!/bin/bash

set -e

# first check if we're passing flags, if so
# prepend with sentry
if [ "${1:0:1}" = '-' ]; then
	set -- sentry "$@"
fi

VALID_COMMANDS=$(python -c 'import pkgutil; import os.path; import sentry.runner.commands as c; print("|".join([name for _, name, _ in pkgutil.iter_modules([os.path.dirname(c
.__file__)])]))')
case "$1" in
	"$VALID_COMMANDS")
		set -- sentry "$@"
	;;
esac

if [ "$1" = 'sentry' ]; then
	set -- tini -- "$@"
	if [ "$(id -u)" = '0' ]; then
		mkdir -p "$SENTRY_FILESTORE_DIR"
		find "$SENTRY_FILESTORE_DIR" ! -user sentry -exec chown sentry {} \;
		set -- gosu sentry "$@"
	fi
fi

exec "$@"
