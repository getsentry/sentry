{% load i18n %}{% autoescape off %}#!/bin/bash
set -eu
SIGN=$'\033[2m>\033[0m'
DOWNLOAD_VERSION=1.30.0
MIN_VERSION=1.30.0
MIN_INT_VERSION=`echo $MIN_VERSION|awk -F. '{ printf("%04d%04d%04d\n", $1, $2, $3) }'`

{% if not token %}
echo 'error: the link you followed expired.'
exit 1
{% elif issues %}
echo "{% blocktrans count issues=issues|length %}Looking for {{ issues }} missing debug symbol{% plural %}Looking for {{ issues }} missing debug symbols:{% endblocktrans %}"
{% for issue in issues %}
  echo $'  \033[2m{{ issue.uuid }}\033[0m ({{ issue.name }}; {{ issue.arch }})'
{% endfor %}
echo

HAVE_SENTRY_CLI=0
if hash sentry-cli 2> /dev/null; then
  INSTALLED_VERSION=`sentry-cli --version|awk '{print $2}'|awk -F. '{ printf("%04d%04d%04d\n", $1, $2, $3) }'`
  if (( 10#$INSTALLED_VERSION >= 10#$MIN_INT_VERSION )); then
    HAVE_SENTRY_CLI=1
    CLI=sentry-cli
  fi
fi

if [ "$HAVE_SENTRY_CLI" == "0" ]; then
  DOWNLOAD_URL="https://github.com/getsentry/sentry-cli/releases/download/$DOWNLOAD_VERSION/sentry-cli-Darwin-x86_64"
  TEMP_FILE=`mktemp "${TMPDIR:-/tmp}/.sentrycli.XXXXXXXX"`
  cleanup() {
    rm -f "$TEMP_FILE"
  }
  trap cleanup EXIT
  echo "$SIGN Fetching sentry-cli utility"
  download_start=`date +%s`
  if ! curl -fSL --progress-bar "$DOWNLOAD_URL" -o "$TEMP_FILE" 2>&1; then
    echo "error: could not download sentry-cli"
    exit 1
  fi
  chmod +x "$TEMP_FILE"
  download_end=`date +%s`
  CLI="$TEMP_FILE"
  echo -n $'\033[2A\033[K'
  echo "$SIGN Fetched sentry-cli utility in $((download_end-download_start))s"
  echo -n $'\033[K'
else
  echo "$SIGN Using installed sentry-cli utility"
fi

echo "$SIGN Looking for debug symbols"

export SENTRY_AUTH_TOKEN="{{ token }}"
export SENTRY_URL="{{ server_url }}"
export SENTRY_ORG="{{ project.organization.slug }}"
export SENTRY_PROJECT="{{ project.slug }}"

"$CLI" upload-dsym --derived-data --no-zips{% for issue in issues %} --uuid {{ issue.uuid }}{% endfor %} --require-all
echo
echo $'\033[32mSuccessfully found all symbols!\033[0m'
{% else %}
echo 'There are currently no missing debug symbols for ``{{ project.slug }}``'
{% endif %}
{% endautoescape %}
