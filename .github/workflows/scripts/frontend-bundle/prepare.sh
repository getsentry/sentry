#!/bin/bash
# Packages a production webpack build for SaaS. Run from the repo root after
# `pnpm run build-production` and `pnpm run build-chartcuterie-config`.
#
# Writes to $OUT:
#   frontend-bundle.tar.gz  the build as laid out in the repo, extracted by
#                           getsentry's backend image (single-tenant serves
#                           /_static/dist/ from the image)
#   cdn/_static/            what gets uploaded to the CDN bucket
#   configmap.json          entrypoint -> content-hashed name mapping that
#                           getsentry's GoCD frontend pipeline deploys
set -euxo pipefail

: "${COMMIT_SHA:?}" "${OUT:?}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dist=src/sentry/static/sentry/dist

# Debug IDs are written into the JS files themselves. Inject before packaging
# so the backend image and the CDN carry identical bytes.
sentry-cli sourcemaps inject "${dist}"

mkdir -p "${OUT}"
tar -czf "${OUT}/frontend-bundle.tar.gz" "${dist}" config/chartcuterie/config.js

cdn="${OUT}/cdn/_static/dist/sentry"
mkdir -p "${cdn}"
cp -r "${dist}/." "${cdn}"

# Entrypoints (app.js, sentry.css, ...) have no version in their filenames, so
# the CDN only gets content-hashed copies of them.
entrypoints="${OUT}/entrypoints"
mkdir -p "${entrypoints}"
mv "${cdn}/entrypoints/"* "${entrypoints}"
rmdir "${cdn}/entrypoints"

if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
    # When debug IDs don't match, Sentry falls back to resolving source maps by
    # path, which has to mirror the CDN layout. Upload after the layout is final.
    sentry-cli sourcemaps upload \
        --use-artifact-bundle "${OUT}/cdn" \
        --org sentry \
        --project javascript \
        --release "frontend@${COMMIT_SHA}"
fi

python3 -S "${script_dir}/hashed_entrypoints.py" \
    --sha "${COMMIT_SHA}" \
    --src "${entrypoints}" \
    --dest "${cdn}/entrypoints-hashed" \
    --cfg "${OUT}/configmap.json"
