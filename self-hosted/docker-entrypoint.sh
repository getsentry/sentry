#!/bin/bash

set -e

# first check if we're passing flags, if so
# prepend with sentry
if [ "${1:0:1}" = '-' ]; then
	set -- sentry "$@"
fi

if [[ $1 =~ ^[[:alnum:]]+$ ]] && grep -Fxq "$1" /sentry-commands.txt; then
	set -- sentry "$@";
fi

if [ "$1" = 'sentry' ]; then
	set -- tini -- "$@"
	if [ "$(id -u)" = '0' ]; then
		mkdir -p /data/files
		sentry_uid=$(id -u sentry)
		if [ "$(stat -c %u /data)" != "$sentry_uid" ] || [ "$(stat -c %u /data/files)" != "$sentry_uid" ]; then
			find /data ! -user sentry -exec chown sentry {} \;
		fi
		set -- gosu sentry "$@"
	fi
fi

exec "$@"
