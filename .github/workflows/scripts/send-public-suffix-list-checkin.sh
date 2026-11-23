#!/bin/sh
# Sends a Sentry cron check-in with STATUS (ok or error) for the
# update-public-suffix-list monitor to the project in SENTRY_DSN. Does
# nothing when SENTRY_DSN is empty.
set -eu

if [ -z "${SENTRY_DSN:-}" ]; then
  exit 0
fi
KEY=${SENTRY_DSN#*://}
KEY=${KEY%%@*}
HOST=${SENTRY_DSN#*@}
HOST=${HOST%%/*}
PROJECT=${SENTRY_DSN##*/}
curl -fsS --retry 3 -X POST \
  "https://$HOST/api/$PROJECT/cron/update-public-suffix-list/$KEY/" \
  -H 'Content-Type: application/json' \
  -d "{\"status\": \"$STATUS\", \"monitor_config\": {\"schedule\": {\"type\": \"crontab\", \"value\": \"37 16 * * 1\"}, \"checkin_margin\": 180, \"max_runtime\": 30, \"timezone\": \"UTC\"}}"
