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

# Origin asks for app JWTs of roughly five minutes.
JWT_EXPIRY_SECONDS = 240

# Origin's published Ed25519 public keys. Used to verify the things Origin signs:
# the install receipt today, and webhook deliveries.
CURSOR_ORIGIN_JWKS_URL = f"{CURSOR_ORIGIN_API_BASE_URL}/keys"

CURSOR_ORIGIN_JWKS_CACHE_SECONDS = 600
CURSOR_ORIGIN_JWKS_STALE_SECONDS = 600

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
