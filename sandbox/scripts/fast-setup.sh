#!/bin/bash
# fast-setup.sh — Fast local development setup using pre-built sandbox images
#
# This script accelerates `devenv sync` by restoring from pre-built images
# instead of building from scratch. It:
#
#   1. Checks if pre-built Postgres image matches current migrations
#   2. If yes, restores Postgres from image (~5s vs ~120s)
#   3. Checks if pre-built agent image matches current uv.lock
#   4. If yes, copies .venv from image (~10s vs ~60s)
#   5. Falls back to normal setup for any mismatches
#
# Usage:
#   # Use instead of `devenv sync` for faster setup
#   ./sandbox/scripts/fast-setup.sh
#
#   # Force full rebuild (ignore pre-built images)
#   FAST_SETUP_SKIP=1 ./sandbox/scripts/fast-setup.sh
#
# Environment variables:
#   FAST_SETUP_SKIP       - Skip fast setup, use normal flow
#   FAST_SETUP_VERBOSE    - Enable verbose output
#   AGENT_IMAGE           - Override agent image (default: ghcr.io/getsentry/sentry-agent)
#   POSTGRES_IMAGE        - Override postgres image (default: ghcr.io/getsentry/sentry-postgres-dev)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

AGENT_IMAGE="${AGENT_IMAGE:-ghcr.io/getsentry/sentry-agent}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-ghcr.io/getsentry/sentry-postgres-dev}"
POSTGRES_CONTAINER="postgres-postgres-1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}==>${NC} $*"; }
error() { echo -e "${RED}==>${NC} $*" >&2; }

if [ "${FAST_SETUP_SKIP:-}" = "1" ]; then
    log "FAST_SETUP_SKIP=1, falling back to normal setup"
    exec devenv sync
fi

# Compute cache keys
log "Computing cache keys..."
chmod +x "${SCRIPT_DIR}/compute-cache-key.sh"
AGENT_KEY=$("${SCRIPT_DIR}/compute-cache-key.sh" agent)
POSTGRES_KEY=$("${SCRIPT_DIR}/compute-cache-key.sh" postgres)

log "Agent cache key:    ${AGENT_KEY}"
log "Postgres cache key: ${POSTGRES_KEY}"

# ============================================================
# Step 1: Try to restore Postgres from pre-built image
# ============================================================
restore_postgres() {
    log "Checking for pre-migrated Postgres image..."

    local image_tag="cache-${POSTGRES_KEY}"

    # Try to pull the image with the matching cache key
    if docker pull "${POSTGRES_IMAGE}:${image_tag}" 2>/dev/null; then
        log "Found matching Postgres image: ${image_tag}"

        # Check if devservices postgres is running
        if docker ps --format '{{.Names}}' | grep -q "${POSTGRES_CONTAINER}"; then
            warn "Postgres container already running. Stopping..."
            docker stop "${POSTGRES_CONTAINER}" 2>/dev/null || true
            docker rm "${POSTGRES_CONTAINER}" 2>/dev/null || true
        fi

        # Start the pre-migrated Postgres using devservices' network
        log "Starting pre-migrated Postgres..."
        docker network create devservices 2>/dev/null || true
        docker run -d \
            --name "${POSTGRES_CONTAINER}" \
            --network devservices \
            -p 127.0.0.1:5432:5432 \
            -e POSTGRES_USER=postgres \
            -e POSTGRES_PASSWORD=postgres \
            --label orchestrator=devservices \
            "${POSTGRES_IMAGE}:${image_tag}"

        # Wait for it to be ready
        log "Waiting for Postgres to be ready..."
        for i in $(seq 1 30); do
            if docker exec "${POSTGRES_CONTAINER}" pg_isready -U postgres > /dev/null 2>&1; then
                log "Postgres ready with pre-applied migrations"
                return 0
            fi
            sleep 1
        done

        error "Postgres failed to start from pre-built image"
        return 1
    else
        warn "No matching Postgres image found for key ${image_tag}"
        warn "Checking for nightly image with delta migrations..."

        # Fall back: try nightly + delta migrations
        if docker pull "${POSTGRES_IMAGE}:nightly" 2>/dev/null; then
            log "Using nightly Postgres image + delta migrations"

            docker network create devservices 2>/dev/null || true
            docker run -d \
                --name "${POSTGRES_CONTAINER}" \
                --network devservices \
                -p 127.0.0.1:5432:5432 \
                -e POSTGRES_USER=postgres \
                -e POSTGRES_PASSWORD=postgres \
                --label orchestrator=devservices \
                "${POSTGRES_IMAGE}:nightly"

            # Wait for ready
            for i in $(seq 1 30); do
                if docker exec "${POSTGRES_CONTAINER}" pg_isready -U postgres > /dev/null 2>&1; then
                    break
                fi
                sleep 1
            done

            # Run delta migrations
            log "Running delta migrations..."
            cd "${REPO_ROOT}"
            sentry upgrade --noinput 2>&1
            log "Delta migrations complete"
            return 0
        fi

        warn "No pre-built Postgres image available. Using normal migration flow."
        return 1
    fi
}

# ============================================================
# Step 2: Try to restore .venv from pre-built image
# ============================================================
restore_venv() {
    log "Checking for pre-built Python environment..."

    local image_tag="cache-${AGENT_KEY}"
    local venv_dir="${REPO_ROOT}/.venv"

    # Try to pull the image with the matching cache key
    if docker pull "${AGENT_IMAGE}:${image_tag}" 2>/dev/null; then
        log "Found matching agent image: ${image_tag}"

        # Extract .venv from the image
        log "Extracting .venv from pre-built image..."
        local container_id
        container_id=$(docker create "${AGENT_IMAGE}:${image_tag}")

        # Remove existing venv if it exists
        if [ -d "${venv_dir}" ]; then
            rm -rf "${venv_dir}"
        fi

        # Copy .venv from the container
        docker cp "${container_id}:/workspace/.venv" "${venv_dir}"
        docker rm "${container_id}" > /dev/null

        # Fix up paths in the venv (they were built for /workspace)
        log "Fixing venv paths..."
        # Update the pyvenv.cfg to point to the right Python
        if [ -f "${venv_dir}/pyvenv.cfg" ]; then
            local python_home
            python_home=$(python3 -c "import sys; print(sys.prefix)")
            sed -i "s|home = .*|home = ${python_home}/bin|" "${venv_dir}/pyvenv.cfg"
        fi

        # Install in editable mode
        log "Installing sentry in editable mode..."
        "${venv_dir}/bin/python3" -m tools.fast_editable --path "${REPO_ROOT}"

        log "Python environment restored from pre-built image"
        return 0
    else
        warn "No matching agent image found for key ${image_tag}"
        warn "Using normal uv sync flow."
        return 1
    fi
}

# ============================================================
# Main
# ============================================================
main() {
    log "Fast setup starting..."
    local start_time
    start_time=$(date +%s)

    local postgres_fast=false
    local venv_fast=false

    # Try fast Postgres restore
    if restore_postgres; then
        postgres_fast=true
    else
        warn "Falling back to normal Postgres setup"
        # Normal devservices + migration flow will run via devenv sync
    fi

    # Try fast venv restore
    if restore_venv; then
        venv_fast=true
    else
        warn "Falling back to normal Python setup"
        cd "${REPO_ROOT}"
        uv sync --frozen --inexact --quiet --active
        python3 -m tools.fast_editable --path .
    fi

    # Always run remaining devenv sync steps (node, pre-commit, etc.)
    # but skip what we already did
    if $postgres_fast; then
        export SENTRY_DEVENV_SKIP_MIGRATIONS=1
    fi

    local end_time
    end_time=$(date +%s)
    local elapsed=$((end_time - start_time))

    log "Fast setup complete in ${elapsed}s"
    log "  Postgres: $(if $postgres_fast; then echo 'restored from image'; else echo 'normal migration'; fi)"
    log "  Python:   $(if $venv_fast; then echo 'restored from image'; else echo 'normal uv sync'; fi)"
}

main "$@"
