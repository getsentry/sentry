#!/bin/bash
# Uploads a bundle packaged by prepare.sh.
#
# configmap.json is uploaded last. getsentry's backend image build and its GoCD
# frontend deploy wait for it, so once it exists everything else for this SHA
# is already in place.
set -euxo pipefail

: "${COMMIT_SHA:?}" "${OUT:?}" "${STATIC_BUCKET:?}" "${FRONTEND_BUNDLE_BUCKET:?}"

dest="gs://${FRONTEND_BUNDLE_BUCKET}/${COMMIT_SHA}"

# A published SHA is immutable: a rebuild may not be byte-identical, and the
# backend image and CDN must keep agreeing with the configmap already out there.
if gcloud storage ls "${dest}/configmap.json" &>/dev/null; then
    echo "${dest}/configmap.json already exists, nothing to do"
    exit 0
fi

# Everything uploaded under _static/dist has a content hash in its name, so a
# 10 year cache is safe. --gzip-local stores these with Content-Encoding: gzip
# and the uncompressed Content-Type.
gcloud storage cp -r \
    --cache-control="public, max-age=315360000" \
    --predefined-acl=publicRead \
    --gzip-local=js,map,css,svg,html,txt,ico,eot,ttf \
    "${OUT}/cdn/_static" \
    "gs://${STATIC_BUCKET}"

gcloud storage cp "${OUT}/frontend-bundle.tar.gz" "${dest}/frontend-bundle.tar.gz"
gcloud storage cp "${OUT}/configmap.json" "${dest}/configmap.json"
