#!/bin/bash
set -eu

GS_BUCKET_NAME=sentryio-storybook
DEPLOY_BRANCH=${TRAVIS_PULL_REQUEST_BRANCH:-$TRAVIS_BRANCH}
echo "Build branch: ${DEPLOY_BRANCH}"

# Transform the branch name to a bucket directory
BRANCH_PROCESSED=$(echo "${DEPLOY_BRANCH}" | tr '[:upper:]./' '[:lower:]--' | tr -cd '[:alnum:]-_')
BUCKET_DIR_NAME="branches/${BRANCH_PROCESSED}"
echo "Bucket directory: ${BUCKET_DIR_NAME}"

npm run storybook-build

# Upload the files
gsutil -m rsync -r -d .storybook-out/ "gs://${GS_BUCKET_NAME}/${BUCKET_DIR_NAME}"

# Upload build metadata
echo "{\"branch\": \"${DEPLOY_BRANCH}\", \"commit\": \"${TRAVIS_COMMIT}\", \"synced_at\": $(date +%s)}" > build-info.json
gsutil cp build-info.json "gs://${GS_BUCKET_NAME}/${BUCKET_DIR_NAME}"
