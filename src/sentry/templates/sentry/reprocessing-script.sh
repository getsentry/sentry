{% autoescape off %}#!/bin/sh
set -eu

DOWNLOAD_URL="https://github.com/getsentry/sentry-cli/releases/download/1.4.1/sentry-cli-Darwin-x86_64"

if hash sentry-cli 2> /dev/null; then
  CLI=sentry-cli
else
  if ! hash curl 2> /dev/null; then
    echo "error: you do not have 'curl' installed which is required for this script."
    exit 1
  fi
  TEMP_FILE=`mktemp "${TMPDIR:-/tmp}/.sentrycli.XXXXXXXX"`
  cleanup() {
    rm -f "$TEMP_FILE"
  }
  trap cleanup EXIT
  echo "🔗  Downloading sentry-cli to upload"
  curl -SL --progress-bar "$DOWNLOAD_URL" > "$TEMP_FILE"
  chmod +x "$TEMP_FILE"
  CLI="$TEMP_FILE"
fi

{% if token %}export SENTRY_AUTH_TOKEN="{{ token }}"{% endif %}
export SENTRY_ORG="{{ project.organization.slug }}"
export SENTRY_PROJECT="{{ project.slug }}"

"$CLI" upload-dsym --derived-data --no-zips{% for issue in issues %} --uuid {{ issue.data.image_uuid }}{% endfor %}
echo '🌟  Done!'
{% endautoescape %}
