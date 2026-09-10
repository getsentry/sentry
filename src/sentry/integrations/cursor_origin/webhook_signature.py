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

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from sentry.integrations.cursor_origin.constants import WEBHOOK_MAX_AGE_SECONDS
from sentry.integrations.cursor_origin.keys import fetch_public_keys

logger = logging.getLogger("sentry.integrations.cursor_origin")

_SIGNATURE_PREFIX = "v1ed,"


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
        # Covers binascii.Error for bad padding or non-base64 characters, which is
        # a ValueError subclass. See test_rejects_malformed_base64.
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
