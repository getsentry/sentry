from __future__ import annotations

import base64
import logging
from typing import Any, NamedTuple

from django.core.cache import cache

from sentry.http import safe_urlopen
from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_JWKS_CACHE_SECONDS,
    CURSOR_ORIGIN_JWKS_STALE_SECONDS,
    CURSOR_ORIGIN_JWKS_URL,
)

logger = logging.getLogger("sentry.integrations.cursor_origin")

_FRESH_CACHE_KEY = "cursor-origin:jwks:fresh"
_STALE_CACHE_KEY = "cursor-origin:jwks:stale"

_ED25519_PUBLIC_KEY_BYTES = 32


class OriginSigningKey(NamedTuple):
    kid: str | None
    public_key: bytes


def _b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _decode_jwks(payload: Any) -> list[OriginSigningKey]:
    if not isinstance(payload, dict):
        logger.warning("cursor_origin.jwks_malformed", extra={"reason": "payload_not_object"})
        return []

    raw_keys = payload.get("keys")
    if not isinstance(raw_keys, list):
        logger.warning("cursor_origin.jwks_malformed", extra={"reason": "keys_not_list"})
        return []

    keys: list[OriginSigningKey] = []
    for key in raw_keys:
        if not isinstance(key, dict) or key.get("crv") != "Ed25519":
            continue

        material = key.get("x")
        if not isinstance(material, str):
            continue

        kid = key.get("kid")
        if kid is not None and not isinstance(kid, str):
            kid = None

        try:
            public_key = _b64url_decode(material)
        except (ValueError, TypeError):
            # One bad key must not discard the well-formed ones beside it.
            logger.warning("cursor_origin.jwks_key_undecodable", extra={"kid": kid})
            continue

        if len(public_key) != _ED25519_PUBLIC_KEY_BYTES:
            logger.warning(
                "cursor_origin.jwks_key_wrong_length",
                extra={"kid": kid, "length": len(public_key)},
            )
            continue

        keys.append(OriginSigningKey(kid=kid, public_key=public_key))

    return keys


def _fetch_jwks() -> list[OriginSigningKey]:
    """Fetch and decode Origin's JWKS, or return nothing if that is not possible."""
    try:
        response = safe_urlopen(CURSOR_ORIGIN_JWKS_URL, method="GET", timeout=5)
        response.raise_for_status()
        payload: Any = response.json()
    except Exception:
        logger.warning("cursor_origin.jwks_fetch_failed", exc_info=True)
        return []

    return _decode_jwks(payload)


def _from_cache(cache_key: str) -> list[OriginSigningKey] | None:
    cached = cache.get(cache_key)
    if not cached:
        return None
    return [OriginSigningKey(kid=kid, public_key=bytes(public_key)) for kid, public_key in cached]


def fetch_public_keys(*, force_refresh: bool = False) -> list[OriginSigningKey]:
    if not force_refresh:
        cached = _from_cache(_FRESH_CACHE_KEY)
        if cached is not None:
            return cached

    keys = _fetch_jwks()
    if keys:
        raw = [(key.kid, key.public_key) for key in keys]
        cache.set(_FRESH_CACHE_KEY, raw, CURSOR_ORIGIN_JWKS_CACHE_SECONDS)
        cache.set(
            _STALE_CACHE_KEY,
            raw,
            CURSOR_ORIGIN_JWKS_CACHE_SECONDS + CURSOR_ORIGIN_JWKS_STALE_SECONDS,
        )
        return keys

    stale = _from_cache(_STALE_CACHE_KEY)
    if stale is not None:
        logger.warning("cursor_origin.jwks_serving_stale", extra={"key_count": len(stale)})
        return stale

    return []


def signing_keys_for(kid: str | None) -> list[OriginSigningKey]:
    """Candidate keys for a signature. Empty means reject, never skip verification."""
    keys = fetch_public_keys()

    if kid is None:
        return keys

    match = [key for key in keys if key.kid == kid]
    if match:
        return match

    match = [key for key in fetch_public_keys(force_refresh=True) if key.kid == kid]
    if not match:
        logger.warning("cursor_origin.jwks_no_key_for_kid", extra={"kid": kid})
    return match
