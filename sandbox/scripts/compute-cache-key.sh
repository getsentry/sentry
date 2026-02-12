#!/bin/bash
# compute-cache-key.sh — Compute content-hash cache keys for sandbox images
#
# These cache keys determine when images need to be rebuilt.
# Images are tagged with both a human-readable tag and a content hash.
#
# Usage:
#   ./sandbox/scripts/compute-cache-key.sh agent     # => abc123def456
#   ./sandbox/scripts/compute-cache-key.sh postgres   # => 789012fed345

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

compute_agent_key() {
    # Agent image cache key: hash of dependency lockfiles + python version
    local hash_input=""

    # Python dependencies
    if [ -f "${REPO_ROOT}/uv.lock" ]; then
        hash_input+=$(sha256sum "${REPO_ROOT}/uv.lock" | cut -d' ' -f1)
    fi

    # Node dependencies
    if [ -f "${REPO_ROOT}/pnpm-lock.yaml" ]; then
        hash_input+=$(sha256sum "${REPO_ROOT}/pnpm-lock.yaml" | cut -d' ' -f1)
    fi

    # Python version
    if [ -f "${REPO_ROOT}/.python-version" ]; then
        hash_input+=$(cat "${REPO_ROOT}/.python-version")
    fi

    # Dockerfile itself (changes to build process)
    if [ -f "${REPO_ROOT}/sandbox/images/Dockerfile.agent" ]; then
        hash_input+=$(sha256sum "${REPO_ROOT}/sandbox/images/Dockerfile.agent" | cut -d' ' -f1)
    fi

    echo -n "${hash_input}" | sha256sum | cut -c1-12
}

compute_postgres_key() {
    # Postgres image cache key: hash of all migration files
    local hash_input=""

    # Hash all migration files (sorted for determinism)
    hash_input=$(find "${REPO_ROOT}/src" -path "*/migrations/*.py" \
        -not -name "__init__.py" \
        -type f \
        -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-12)

    echo -n "${hash_input}"
}

case "${1:-}" in
    agent)
        compute_agent_key
        ;;
    postgres)
        compute_postgres_key
        ;;
    all)
        echo "agent=$(compute_agent_key)"
        echo "postgres=$(compute_postgres_key)"
        ;;
    *)
        echo "Usage: $0 {agent|postgres|all}"
        echo ""
        echo "Compute content-hash cache keys for sandbox images."
        echo "Used to determine when images need rebuilding."
        exit 1
        ;;
esac
