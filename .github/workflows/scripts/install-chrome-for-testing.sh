#!/bin/sh
# Installs Chrome for Testing $CHROME_FOR_TESTING_VERSION and its matching
# chromedriver into $CHROME_FOR_TESTING_DIR, and puts them on PATH as
# google-chrome and chromedriver. The Arm runner image ships no Chrome, and
# the x64 image's Chrome changes with each image release, so acceptance
# pins one build for both.
set -eu

: "${CHROME_FOR_TESTING_VERSION:?}"
: "${CHROME_FOR_TESTING_DIR:?}"
: "${GITHUB_PATH:?}"

arch=$(uname -m)
case "$arch" in
  x86_64) platform=linux64 ;;
  aarch64) platform=linux-arm64 ;;
  *)
    echo "Chrome for Testing has no Linux build for $arch" >&2
    exit 1
    ;;
esac

chrome="$CHROME_FOR_TESTING_DIR/chrome-$platform/chrome"
chromedriver="$CHROME_FOR_TESTING_DIR/chromedriver-$platform/chromedriver"

# A cache hit from actions/cache leaves both in place.
if [ ! -x "$chrome" ] || [ ! -x "$chromedriver" ]; then
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  trap 'exit 1' INT TERM
  mkdir -p "$CHROME_FOR_TESTING_DIR"
  base_url="https://storage.googleapis.com/chrome-for-testing-public/$CHROME_FOR_TESTING_VERSION/$platform"
  for name in chrome chromedriver; do
    curl --fail --silent --show-error --location \
      --retry 3 --retry-all-errors --connect-timeout 10 --max-time 300 \
      --output "$tmp/$name.zip" "$base_url/$name-$platform.zip"
    unzip -q -o "$tmp/$name.zip" -d "$CHROME_FOR_TESTING_DIR"
  done
fi

# Chrome fails to start when a shared library it links is missing. Images
# that ship Chrome already have them, so this only installs when needed.
if ! "$chrome" --version >/dev/null 2>&1; then
  attempt=1
  until timeout -k 30 240 pnpm --filter @sentry-internal/sentry-test exec playwright install-deps chromium; do
    if [ "$attempt" -ge 3 ]; then
      echo "Installing Chrome's system libraries failed after $attempt attempts" >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    sleep 15
  done
fi

bin="$CHROME_FOR_TESTING_DIR/bin"
mkdir -p "$bin"
ln -sf "$chrome" "$bin/google-chrome"
ln -sf "$chromedriver" "$bin/chromedriver"
echo "$bin" >>"$GITHUB_PATH"

"$chrome" --version
"$chromedriver" --version
