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
fi

exec "$@"
