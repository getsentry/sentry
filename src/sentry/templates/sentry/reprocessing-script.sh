{% autoescape off %}#!/bin/sh
set -eu

{% if not token %}
echo '😕  The link you followed expired.'
exit 1
{% elif issues %}
echo "There are currently {{ issues|length }} missing debug symbols:"
{% for issue in issues %}
  echo "   - {{ issue.uuid }}  [{{ issue.name }}]"
{% endfor %}

DOWNLOAD_URL="https://github.com/getsentry/sentry-cli/releases/download/1.5.0/sentry-cli-Darwin-x86_64"
TEMP_FILE=`mktemp "${TMPDIR:-/tmp}/.sentrycli.XXXXXXXX"`
cleanup() {
  rm -f "$TEMP_FILE"
}
trap cleanup EXIT
echo "🔗  Fetching sentry-cli utility"
curl -SL --progress-bar "$DOWNLOAD_URL" > "$TEMP_FILE"
chmod +x "$TEMP_FILE"
CLI="$TEMP_FILE"
echo -n $'\033[2A\033[K'
echo "⚙️  Fetched sentry-cli utility"
echo -n $'\033[K'
echo "👀  Looking for debug symbols"

export SENTRY_AUTH_TOKEN="{{ token }}"
export SENTRY_URL="{{ server_url }}"
export SENTRY_ORG="{{ project.organization.slug }}"
export SENTRY_PROJECT="{{ project.slug }}"

"$CLI" upload-dsym --derived-data --no-zips{% for issue in issues %} --uuid {{ issue.uuid }}{% endfor %}
echo '🌟  Done!'
{% else %}
echo '🎉  Good news. No missing debug symbols!  Nothing to do here.'
{% endif %}
{% endautoescape %}
