from __future__ import annotations

CURSOR_ORIGIN_API_BASE_URL = "https://api.cursor.com/v1/origin"
CURSOR_ORIGIN_WEB_BASE_URL = "https://cursor.com/codebase"
CURSOR_ORIGIN_GIT_BASE_URL = "https://origin.cursor.com"

# Where users are sent to install the app on their codebase.
CURSOR_ORIGIN_INSTALL_URL = "https://cursor.com/codebase/apps/install"

# The `aud` claim Origin requires on app JWTs.
CURSOR_ORIGIN_JWT_AUDIENCE = "origin-apps"

# Origin caps app JWTs at ~5 minutes. Stay comfortably inside it.
JWT_EXPIRY_SECONDS = 240

# Origin's published Ed25519 public keys. Used to verify things Origin signed:
# the install receipt, and webhook deliveries.
CURSOR_ORIGIN_JWKS_URL = f"{CURSOR_ORIGIN_API_BASE_URL}/keys"
CURSOR_ORIGIN_JWKS_CACHE_SECONDS = 3600

# Installation tokens expire in under 15 minutes -- far shorter than GitHub's hour.
# Refresh well ahead of expiry so a long-running request can't straddle the boundary.
TOKEN_MINIMUM_VALIDITY_SECONDS = 180

# Scopes requested at install time. The app's registered permissions are the ceiling;
# this is the actual grant.
CURSOR_ORIGIN_SCOPES = (
    "repository:metadata:read",
    "repository:contents:read",
    "repository:contents:write",
    "repository:pull_requests:read",
    "repository:pull_requests:write",
    "repository:pull_requests:reviews:read",
    "repository:pull_requests:reviews:write",
    "repository:checks:read",
    "repository:checks:write",
)

# Origin's guidance for rejecting replayed deliveries.
WEBHOOK_MAX_AGE_SECONDS = 300
