from __future__ import annotations

import time

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from sentry import options
from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_JWT_AUDIENCE,
    JWT_EXPIRY_SECONDS,
)


def _load_private_key(private_key: str) -> Ed25519PrivateKey:
    """Parse the app's Ed25519 signing key.

    Unlike GitHub's RS256 keys, PyJWT will not accept the PEM string directly for
    EdDSA -- it needs a key object -- so the load step is mandatory here.
    """
    if not private_key:
        # Unset in this environment. Say so, rather than failing inside
        # cryptography on an empty buffer or on None.encode().
        raise ValueError("cursor-origin-app.private-key is not configured")
    key = serialization.load_pem_private_key(private_key.encode("utf-8"), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise ValueError(f"cursor-origin-app.private-key is not Ed25519: {type(key).__name__}")
    return key


def get_jwt(app_id: str | None = None, private_key: str | None = None) -> str:
    """Mint a short-lived app JWT for Origin's app-level endpoints."""
    if app_id is None:
        app_id = str(options.get("cursor-origin-app.id"))
    if private_key is None:
        private_key = options.get("cursor-origin-app.private-key")

    now = int(time.time())
    return jwt.encode(
        {
            # Allow for a little clock skew between us and Origin.
            "iat": now - 30,
            "exp": now + JWT_EXPIRY_SECONDS,
            "iss": app_id,
            "aud": CURSOR_ORIGIN_JWT_AUDIENCE,
        },
        _load_private_key(private_key),
        algorithm="EdDSA",
        headers={"kid": app_id},
    )
