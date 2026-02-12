#!/bin/bash
# build-postgres-image.sh — Build pre-migrated Postgres image for Sentry
#
# This script orchestrates the multi-step process:
#   1. Start a temporary Postgres container
#   2. Run Sentry migrations against it (using the agent image)
#   3. pg_dump all 4 databases
#   4. Build the final Postgres image with dumps baked in
#
# Usage:
#   ./sandbox/scripts/build-postgres-image.sh [--tag TAG] [--agent-image IMAGE]
#
# Environment variables:
#   AGENT_IMAGE     - Agent image to use for migrations (default: ghcr.io/getsentry/sentry-agent:nightly)
#   POSTGRES_IMAGE  - Base postgres image (default: postgres:17-bookworm)
#   OUTPUT_TAG      - Tag for the built image (default: ghcr.io/getsentry/sentry-postgres-dev:nightly)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DUMPS_DIR="${REPO_ROOT}/sandbox/.dumps"

AGENT_IMAGE="${AGENT_IMAGE:-ghcr.io/getsentry/sentry-agent:nightly}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:17-bookworm}"
OUTPUT_TAG="${OUTPUT_TAG:-ghcr.io/getsentry/sentry-postgres-dev:nightly}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag) OUTPUT_TAG="$2"; shift 2 ;;
        --agent-image) AGENT_IMAGE="$2"; shift 2 ;;
        --postgres-image) POSTGRES_IMAGE="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Unique names to avoid collisions
BUILD_ID="sentry-pgbuild-$(date +%s)-$$"
PG_CONTAINER="${BUILD_ID}-postgres"
NETWORK="${BUILD_ID}-net"

cleanup() {
    echo "==> Cleaning up..."
    docker rm -f "${PG_CONTAINER}" 2>/dev/null || true
    docker network rm "${NETWORK}" 2>/dev/null || true
    echo "    Cleanup done"
}
trap cleanup EXIT

echo "==> Building pre-migrated Postgres image"
echo "    Agent image:    ${AGENT_IMAGE}"
echo "    Postgres image: ${POSTGRES_IMAGE}"
echo "    Output tag:     ${OUTPUT_TAG}"
echo ""

# Step 1: Create a Docker network for the build
echo "==> Step 1: Creating build network..."
docker network create "${NETWORK}"

# Step 2: Start a temporary Postgres container
echo "==> Step 2: Starting temporary Postgres..."
docker run -d \
    --name "${PG_CONTAINER}" \
    --network "${NETWORK}" \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=sentry \
    "${POSTGRES_IMAGE}"

# Wait for Postgres to be ready
echo "    Waiting for Postgres to accept connections..."
for i in $(seq 1 30); do
    if docker exec "${PG_CONTAINER}" pg_isready -U postgres > /dev/null 2>&1; then
        echo "    Postgres is ready"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Postgres failed to start"
        exit 1
    fi
    sleep 1
done

# Step 3: Create all 4 databases
echo "==> Step 3: Creating databases..."
for db in control region secondary; do
    docker exec "${PG_CONTAINER}" createdb -U postgres "${db}" || true
done
echo "    Databases created: sentry, control, region, secondary"

# Step 4: Run migrations using the agent image
echo "==> Step 4: Running Sentry migrations..."
docker run --rm \
    --network "${NETWORK}" \
    -e DATABASE_URL="postgresql://postgres:postgres@${PG_CONTAINER}:5432/sentry" \
    -e SENTRY_POSTGRES_HOST="${PG_CONTAINER}" \
    -e SENTRY_POSTGRES_PORT=5432 \
    -e SENTRY_DB_USER=postgres \
    -e SENTRY_DB_PASSWORD=postgres \
    -e SENTRY_SKIP_SERVICE_VALIDATION=1 \
    "${AGENT_IMAGE}" \
    sentry upgrade --noinput

echo "    Migrations complete"

# Step 5: Create the superuser
echo "==> Step 5: Creating superuser..."
docker run --rm \
    --network "${NETWORK}" \
    -e DATABASE_URL="postgresql://postgres:postgres@${PG_CONTAINER}:5432/sentry" \
    -e SENTRY_POSTGRES_HOST="${PG_CONTAINER}" \
    -e SENTRY_POSTGRES_PORT=5432 \
    -e SENTRY_DB_USER=postgres \
    -e SENTRY_DB_PASSWORD=postgres \
    -e SENTRY_SKIP_SERVICE_VALIDATION=1 \
    "${AGENT_IMAGE}" \
    sentry createuser --superuser --email admin@sentry.io --password admin --no-input

# Step 6: Dump all databases
echo "==> Step 6: Dumping databases..."
mkdir -p "${DUMPS_DIR}"
for db in sentry control region secondary; do
    echo "    Dumping ${db}..."
    docker exec "${PG_CONTAINER}" \
        pg_dump -U postgres --no-owner --no-acl "${db}" > "${DUMPS_DIR}/${db}.sql"
    size=$(du -sh "${DUMPS_DIR}/${db}.sql" | cut -f1)
    echo "    ${db}: ${size}"
done

# Step 7: Build the final image
echo "==> Step 7: Building final Postgres image..."
docker build \
    -f "${REPO_ROOT}/sandbox/images/Dockerfile.postgres" \
    --build-arg "DUMPS_DIR=sandbox/.dumps" \
    -t "${OUTPUT_TAG}" \
    "${REPO_ROOT}"

echo ""
echo "==> Build complete!"
echo "    Image: ${OUTPUT_TAG}"
echo ""
echo "    To test:"
echo "    docker run -d -p 5432:5432 ${OUTPUT_TAG}"
echo "    psql -h localhost -U postgres -d sentry -c 'SELECT COUNT(*) FROM django_migrations'"
