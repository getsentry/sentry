#!/bin/bash
set -x
#wait for postgres and redis
# wait for pg to be available!!
sleep 10
sysctl -p

make develop

mkdir /tmp/sentry/
mv /etc/sentry/* /tmp/sentry/

sentry init --dev
mv /tmp/sentry/* /etc/sentry/
sentry upgrade

sentry createuser   --email docker@sentry.io --password docker  --superuser --no-input || true

sentry devserver --workers 0.0.0.0:8000
