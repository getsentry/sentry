from __future__ import annotations

CURSOR_ORIGIN_API_BASE_URL = "https://api.cursor.com/v1/origin"

# Origin's web app, where repositories and files are browsed. Stack-trace links
# point here.
#   repo   {base}/{owner}/{repo}/tree/{branch}
#   file   {base}/{owner}/{repo}/blob/{branch}/{path}#L5
# The branch is a single percent-encoded path segment
CURSOR_ORIGIN_WEB_BASE_URL = "https://cursor.com/codebase"

# Where a workspace admin is sent to grant the app access to their codebase.
CURSOR_ORIGIN_INSTALL_URL = "https://cursor.com/codebase/apps/install"

CURSOR_ORIGIN_JWT_AUDIENCE = "origin-apps"

CURSOR_ORIGIN_ISSUER = "https://api.cursor.com/v1/origin"
CURSOR_ORIGIN_RECEIPT_TYP = "origin-installation-receipt+jwt"

CURSOR_ORIGIN_CLOCK_SKEW_SECONDS = 30

CURSOR_ORIGIN_WEBHOOK_SIGNATURE_PREFIX = "v1ed,"
CURSOR_ORIGIN_WEBHOOK_TOLERANCE_SECONDS = 300

# Covers Origin's automatic retry window (5s, 30s, 1m, 2m, 4m, 8m).
# API-triggered redeliveries arrive later and should be processed again.
CURSOR_ORIGIN_WEBHOOK_DEDUPE_SECONDS = 20 * 60

# Origin asks for app JWTs of roughly five minutes.
JWT_EXPIRY_SECONDS = 240

# Origin's published Ed25519 public keys. Used to verify the things Origin signs:
# the install receipt today, and webhook deliveries.
CURSOR_ORIGIN_JWKS_URL = f"{CURSOR_ORIGIN_API_BASE_URL}/keys"

CURSOR_ORIGIN_JWKS_CACHE_SECONDS = 600
CURSOR_ORIGIN_JWKS_STALE_SECONDS = 600

# Origin installation tokens last at most 15 minutes. Refresh this far ahead of
# expiry so a long request can't straddle it.
TOKEN_MINIMUM_VALIDITY_SECONDS = 180

PAGE_SIZE = 100

CURSOR_ORIGIN_SCOPES = (
    "repository:contents:read",
    "repository:contents:write",
    "repository:pull_requests:read",
    "repository:pull_requests:write",
    "repository:pull_requests:reviews:read",
    "repository:pull_requests:reviews:write",
    "repository:checks:read",
    "repository:checks:write",
)
