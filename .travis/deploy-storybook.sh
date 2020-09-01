#!/bin/bash
set -eu

if [[ "$TRAVIS_SECURE_ENV_VARS" == "false" ]]; then
  echo "Secrets are not available, skipping actual deploy."
  exit;
fi

# Decrypt the credentials we added to the repo using the key we added with the Travis command line tool
openssl aes-256-cbc -K $encrypted_020be61ef175_key -iv $encrypted_020be61ef175_iv -in .travis/storybook-credentials.tar.gz.enc -out credentials.tar.gz -d
# If the SDK is not already cached, download it and unpack it
if [ ! -d ${HOME}/google-cloud-sdk ]; then curl https://sdk.cloud.google.com | bash; fi
echo "gcloud version: $(gcloud version)"
# Use the decrypted service account credentials to authenticate the command line tool
tar -xzf credentials.tar.gz
gcloud auth activate-service-account --key-file client-secret.json

GS_BUCKET_NAME=sentryio-storybook
DEPLOY_BRANCH=${TRAVIS_PULL_REQUEST_BRANCH:-$TRAVIS_BRANCH}
echo "Build branch: ${DEPLOY_BRANCH}"

# Transform the branch name to a bucket directory
BRANCH_PROCESSED=$(echo "${DEPLOY_BRANCH}" | tr '[:upper:]./' '[:lower:]--' | tr -cd '[:alnum:]-_')
BUCKET_DIR_NAME="branches/${BRANCH_PROCESSED}"
echo "Bucket directory: ${BUCKET_DIR_NAME}"

# Upload the files
gsutil cp docs-ui/.storybook-out/favicon.ico "gs://${GS_BUCKET_NAME}/favicon.ico"
gsutil -m rsync -r -d docs-ui/.storybook-out/ "gs://${GS_BUCKET_NAME}/${BUCKET_DIR_NAME}"

# Upload build metadata
echo "{\"branch\": \"${DEPLOY_BRANCH}\", \"commit\": \"${TRAVIS_COMMIT}\", \"synced_at\": $(date +%s)}" > build-info.json
gsutil cp build-info.json "gs://${GS_BUCKET_NAME}/${BUCKET_DIR_NAME}"
