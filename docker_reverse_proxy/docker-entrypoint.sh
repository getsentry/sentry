#!/usr/bin/env bash
set -e

# set resonable defaults for Env variables if they are not defined
export RELAY_PORT=${RELAY_PORT:-3000}
export SENTRY_PORT=${SENTRY_PORT:-8000}
export SENTRY_HOST=${SENTRY_HOST:-host.docker.internal}
export ESC='$'

# replace the env variables into nginx configuration files
envsubst < /etc/nginx/conf.d/reverse-proxy.conf.template >/etc/nginx/conf.d/reverse-proxy.conf

# start nginx in foreground to keep the container from terminating
exec nginx -g "daemon off;"
