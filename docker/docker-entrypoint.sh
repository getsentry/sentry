#!/bin/bash

set -e

# first check if we're passing flags, if so
# prepend with sentry
if [ "${1:0:1}" = '-' ]; then
	set -- sentry "$@"
fi

if [ "$1" != "__init__" ] && [ -f "/usr/local/lib/python2.7/site-packages/sentry/runner/commands/$1.py" ]; then
	set -- sentry "$@";
fi

if [ "$1" = 'sentry' ]; then
	set -- tini -- "$@"
	if [ "$(id -u)" = '0' ]; then
		mkdir -p /data/files
		find /data ! -user sentry -exec chown sentry {} \;
		set -- gosu sentry "$@"
	fi
fi

exec "$@"
