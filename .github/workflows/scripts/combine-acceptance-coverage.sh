#!/bin/sh
# Combines the per-shard acceptance coverage under $1 into $2. Fails unless
# every shard uploaded its coverage, since selection would never pick the tests
# of a missing shard.
set -eu

: "${COVERAGE_VERSION:?}"
src=$1
dest=$2

set -- "$src"/acceptance-coverage-shard-*-of-*/acceptance.coverage
if [ ! -f "$1" ]; then
  echo "::error::No shard uploaded acceptance coverage"
  exit 1
fi
shard_dir=$(dirname "$1")
total=${shard_dir##*-of-}
if [ "$#" -ne "$total" ]; then
  echo "::error::Only $# of $total shards uploaded acceptance coverage"
  exit 1
fi

# --rcfile: setup.cfg names coverage plugins that only the sentry venv has.
uvx --from "coverage==$COVERAGE_VERSION" coverage combine \
  --rcfile=/dev/null --keep --data-file="$dest" "$@"
