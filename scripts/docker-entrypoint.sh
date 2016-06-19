#!/bin/bash
set -ex

# Make sure to always start all the background services
service postgresql start
service redis-server start
service memcached start
service postfix start
service ntp start

if [ ! -f /.bootstrapped ]; then
  SENTRY_LIGHT_BUILD=1 pip install -vvv -e .[dev,tests]
  npm install
  sentry init $SENTRY_CONF
  sentry upgrade --noinput
  sentry createuser --email=root@localhost --password=admin --superuser --no-input
  touch /.bootstrapped

  echo "done" && exit 0
fi

exec "$@"
