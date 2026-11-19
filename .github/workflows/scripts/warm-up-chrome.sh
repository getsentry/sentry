#!/bin/sh
# Launches Chrome and chromedriver once in the background, so the first
# launch's cold disk and font cache cost is paid before the tests run.
set -eu

if command -v google-chrome && command -v chromedriver; then
  user_data_dir=$(mktemp -d)
  setsid nohup timeout 60 google-chrome --headless --no-sandbox --disable-gpu \
    --disable-dev-shm-usage --user-data-dir="$user_data_dir" --window-size=1680,1050 \
    --screenshot="$RUNNER_TEMP/chrome-warmup.png" 'data:text/html,<p>warm</p>' \
    >"$RUNNER_TEMP/chrome-warmup.log" 2>&1 &
  setsid nohup chromedriver --version >/dev/null 2>&1 &
fi
