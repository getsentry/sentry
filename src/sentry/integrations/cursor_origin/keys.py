"""Origin's published Ed25519 public keys.

Origin signs two things we have to check: the install receipt handed back by the
redirect, and webhook deliveries. Both are Ed25519, and neither carries a usable
key id -- webhook signatures have no key id field at all -- so callers try every
active key rather than selecting one.

Verification needs Origin's *public* keys rather than a secret we hold, which is
why this is a fetch rather than an option lookup.
"""

from __future__ import annotations

import base64
import logging
from typing import Any

from django.core.cache import cache

from sentry.http import safe_urlopen
from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_JWKS_CACHE_SECONDS,
    CURSOR_ORIGIN_JWKS_URL,
)

logger = logging.getLogger("sentry.integrations.cursor_origin")

_JWKS_CACHE_KEY = "cursor-origin:jwks"


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
        payload: Any = response.json()
    except Exception:
        logger.warning("cursor_origin.jwks_fetch_failed", exc_info=True)
        return []

    # Everything below is shape-checked rather than assumed. This is an external
    # document, and callers treat an empty list as "cannot verify" and fail closed
    # -- so a malformed JWKS must return nothing, never raise. Raising would take
    # the install pipeline down with a 500 instead of refusing the install.
    if not isinstance(payload, dict):
        logger.warning("cursor_origin.jwks_malformed", extra={"reason": "payload_not_object"})
        return []

    keys: list[bytes] = []
    for key in payload.get("keys") or []:
        if not isinstance(key, dict) or key.get("crv") != "Ed25519":
            continue
        material = key.get("x")
        if not isinstance(material, str):
            continue
        try:
            keys.append(_b64url_decode(material))
        except (ValueError, TypeError):
            # One unusable key must not discard the well-formed ones beside it;
            # that is the difference between a rotation hiccup and an outage.
            logger.warning("cursor_origin.jwks_key_undecodable", extra={"kid": key.get("kid")})

    if keys:
        cache.set(_JWKS_CACHE_KEY, keys, CURSOR_ORIGIN_JWKS_CACHE_SECONDS)
    return keys
