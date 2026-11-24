#!/bin/sh
# Installs Chromium for Playwright, retrying up to 3 times.
#
#   install-playwright.sh deps
#       Install Chromium's system packages with apt. Between attempts, clear
#       any apt locks a killed attempt left behind.
#   install-playwright.sh browser
#       Download the Chromium browser build.
set -eu

mode=${1:-}
case "$mode" in
  deps)
    command=install-deps
    what='playwright install-deps'
    echo 'Acquire::Retries "3";' | sudo tee /etc/apt/apt.conf.d/99-retries
    echo 'Acquire::http::Timeout "30";' | sudo tee -a /etc/apt/apt.conf.d/99-retries
    ;;
  browser)
    command=install
    what='playwright install browser'
    ;;
  *)
    echo "usage: $0 deps|browser" >&2
    exit 2
    ;;
esac

for i in 1 2 3; do
  echo "::group::$what (attempt $i)"
  timeout -k 30 4m pnpm --filter @sentry-internal/sentry-test exec playwright "$command" chromium && ok=1 || ok=0
  echo "::endgroup::"
  [ "$ok" = 1 ] && exit 0
  if [ "$mode" = deps ]; then
    echo "Attempt $i failed; clearing apt locks and retrying in 15s..."
    sudo pkill -9 -f apt-get 2>/dev/null || true
    sudo rm -f /var/lib/apt/lists/lock /var/lib/dpkg/lock* /var/cache/apt/archives/lock 2>/dev/null || true
    sudo dpkg --configure -a 2>/dev/null || true
  else
    echo "Attempt $i failed or timed out; retrying in 15s..."
  fi
  sleep 15
done
if [ "$mode" = deps ]; then
  echo "playwright install-deps failed after 3 attempts"
else
  echo "playwright browser install failed after 3 attempts"
fi
exit 1
