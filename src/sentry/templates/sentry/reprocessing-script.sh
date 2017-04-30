{% load i18n %}{% autoescape off %}#!/bin/sh
set -eu
SIGN=$'\033[2m>\033[0m'

{% if not token %}
echo 'error: the link you followed expired.'
exit 1
{% elif issues %}
echo "{% blocktrans count issues=issues|length %}Looking for {{ issues }} missing debug symbol{% plural %}Looking for {{ issues }} missing debug symbols:{% endblocktrans %}"
{% for issue in issues %}
  echo $'  \033[2m{{ issue.uuid }}\033[0m ({{ issue.name }}; {{ issue.arch }})'
{% endfor %}
echo

DOWNLOAD_URL="https://github.com/getsentry/sentry-cli/releases/download/1.7.0/sentry-cli-Darwin-x86_64"
TEMP_FILE=`mktemp "${TMPDIR:-/tmp}/.sentrycli.XXXXXXXX"`
cleanup() {
  rm -f "$TEMP_FILE"
}
trap cleanup EXIT
echo "$SIGN Fetching sentry-cli utility"
download_start=`date +%s`
curl -SL --progress-bar "$DOWNLOAD_URL" -o "$TEMP_FILE" 2>&1 | tr -u '#' '█'
chmod +x "$TEMP_FILE"
download_end=`date +%s`
CLI="$TEMP_FILE"
echo -n $'\033[2A\033[K'
echo "$SIGN Fetched sentry-cli utility in $((download_end-download_start))s"
echo -n $'\033[K'
echo "$SIGN Looking for debug symbols"

export SENTRY_AUTH_TOKEN="{{ token }}"
export SENTRY_URL="{{ server_url }}"
export SENTRY_ORG="{{ project.organization.slug }}"
export SENTRY_PROJECT="{{ project.slug }}"

"$CLI" upload-dsym --derived-data --no-zips{% for issue in issues %} --uuid {{ issue.uuid }}{% endfor %} --require-all
echo
echo $'\033[32mSuccessfully found all symbols!\033[0m'
{% else %}
echo 'There are currently no missing debug symbols for {{ project.team.name }}/{{ project.name }}'
{% endif %}
{% endautoescape %}
