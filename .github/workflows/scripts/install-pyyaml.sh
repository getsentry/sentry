#!/bin/sh
# Installs the pyyaml version that uv.lock pins for development, without the
# rest of the development dependencies.
set -eu

requirements=$(uv export --only-dev --no-hashes --no-annotate --no-header)
pyyaml=$(printf '%s\n' "$requirements" | grep '^pyyaml')
pyyaml=$(printf '%s\n' "$pyyaml" | sed -E 's/ ;.*//')
printf '%s\n' "$pyyaml" | xargs uv pip install --index-url 'https://pypi.devinfra.sentry.io/simple'
