#!/bin/bash
# Kept for getsentry/self-hosted's sentry/entrypoint.sh, which sources this file.
exec python3 /docker-entrypoint.py "$@"
