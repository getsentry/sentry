#!/bin/bash

set -e

# first check if we're passing flags, if so
# prepend with sentry
if [ "${1:0:1}" = '-' ]; then
	set -- sentry "$@"
fi

case "$1" in
	celery|cleanup|config|createuser|devserver|django|exec|export|help|import|init|plugins|queues|repair|run|shell|start|tsdb|upgrade)
		set -- sentry "$@"
	;;
esac

if [ "$1" = 'sentry' ]; then
	set -- tini -- "$@"
	if [ "$(id -u)" = '0' ]; then
        if [ "$(sentry config get -q filestore.backend)" = 'filesystem']; then
			FILESTORE_DIR=$(sentry config get -q filestore.options | awk 'BEGIN { RS=",|:{\n"; FS="\"|'"'"'"; } $2 == "location" { print $4 }')
			mkdir -p "$FILESTORE_DIR"
			find "$FILESTORE_DIR" ! -user sentry -exec chown sentry {} \;
		fi
		set -- gosu sentry "$@"
	fi
fi

exec "$@"
