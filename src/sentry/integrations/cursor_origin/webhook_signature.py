"""Verify Cursor Origin webhook signatures.

Origin signs with Ed25519 rather than an HMAC shared secret, so verification
needs Origin's *public* keys rather than a secret we hold. They are published as
a JWKS at a well-known endpoint.

Signatures carry no key id, so every active key is tried until one verifies.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import time
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from django.core.cache import cache

from sentry.http import safe_urlopen
from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_JWKS_CACHE_SECONDS,
    CURSOR_ORIGIN_JWKS_URL,
    WEBHOOK_MAX_AGE_SECONDS,
)

logger = logging.getLogger("sentry.integrations.cursor_origin")

_JWKS_CACHE_KEY = "cursor-origin:jwks"
_SIGNATURE_PREFIX = "v1ed,"


def _b64url_decode(value: str) -> bytes:
    """Decode unpadded base64url, as used for JWK key material."""
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def fetch_public_keys(force_refresh: bool = False) -> list[bytes]:
    """Origin's active Ed25519 public keys, cached.

    Cached because every webhook delivery would otherwise fetch the JWKS.
    ``force_refresh`` exists so a signature that fails against every cached key
    can be retried once after rotation, rather than dropping deliveries until
    the cache expires.
    """
    if not force_refresh:
        cached = cache.get(_JWKS_CACHE_KEY)
        if cached is not None:
            return [bytes(k) for k in cached]

    try:
        response = safe_urlopen(CURSOR_ORIGIN_JWKS_URL, method="GET", timeout=5)
        response.raise_for_status()
        payload: dict[str, Any] = response.json()
    except Exception:
        logger.warning("cursor_origin.webhook.jwks_fetch_failed", exc_info=True)
        return []

    keys = [
        _b64url_decode(key["x"])
        for key in payload.get("keys", [])
        if key.get("crv") == "Ed25519" and key.get("x")
    ]
    if keys:
        cache.set(_JWKS_CACHE_KEY, keys, CURSOR_ORIGIN_JWKS_CACHE_SECONDS)
    return keys


def _signed_payload(webhook_id: str, timestamp: str, body: bytes) -> bytes:
    """The bytes Origin actually signs.

    Note this is the lowercase *hex digest* of the id/timestamp/body triple, not
    the triple itself and not the raw digest -- signing the wrong one of those
    three still produces a plausible-looking failure.
    """
    digest = hashlib.sha256(b".".join([webhook_id.encode(), timestamp.encode(), body])).hexdigest()
    return digest.encode()


def is_timestamp_fresh(timestamp: str, now: float | None = None) -> bool:
    """Reject replays. Origin's guidance is a 5 minute window."""
    try:
        sent_at = int(timestamp)
    except (TypeError, ValueError):
        return False
    return abs((now if now is not None else time.time()) - sent_at) <= WEBHOOK_MAX_AGE_SECONDS


def verify_signature(webhook_id: str, timestamp: str, body: bytes, signature: str) -> bool:
    """Whether ``signature`` is a valid Origin signature for this delivery."""
    if not signature.startswith(_SIGNATURE_PREFIX):
        return False

    try:
        raw_signature = base64.b64decode(signature[len(_SIGNATURE_PREFIX) :])
    except (ValueError, TypeError):
        return False

    message = _signed_payload(webhook_id, timestamp, body)

    for force_refresh in (False, True):
        keys = fetch_public_keys(force_refresh=force_refresh)
        for key_bytes in keys:
            try:
                Ed25519PublicKey.from_public_bytes(key_bytes).verify(raw_signature, message)
                return True
            except (InvalidSignature, ValueError):
                continue
        # Only worth refetching if the cache could have been stale.
        if not keys:
            break

    return False
