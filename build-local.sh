#!/usr/bin/env bash
set -euo pipefail

# Accept image name as first argument
if [ $# -eq 0 ]; then
    echo "Usage: $0 <image-name>" >&2
    exit 1
fi

IMAGE_NAME="$1"

echo "Building: ${IMAGE_NAME}" >&2

# Build frontend assets
pnpm install --frozen-lockfile --production
python3 -m tools.fast_editable --path .
python3 -m sentry.build.main

# Build Docker image
docker build \
    -f self-hosted/Dockerfile \
    -t "${IMAGE_NAME}" \
    --platform linux/amd64 \
    --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" \
    --build-arg TARGETARCH=amd64 \
    .

# Output the image name for use in other scripts
echo "${IMAGE_NAME}"
