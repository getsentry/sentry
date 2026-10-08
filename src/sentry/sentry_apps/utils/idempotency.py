"""Stable, destination-specific delivery IDs for outgoing webhook notifications."""

import re
from hashlib import sha256
from uuid import uuid4

_UUID4_HEX_PATTERN = re.compile(r"[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}\Z")


def new_webhook_seed() -> str:
    """Create once at the webhook producer, before its first queue."""
    return uuid4().hex


def derive_idempotency_key(
    seed: str | None, destination_type: str, destination_id: int | str
) -> str | None:
    """Derive a stable delivery key without persisting per-destination state."""
    if seed is None:
        return None
    if not _UUID4_HEX_PATTERN.fullmatch(seed):
        raise ValueError("webhook idempotency seed must be lowercase UUID4 hex")
    return sha256(f"{seed}:{destination_type}:{destination_id}".encode()).hexdigest()[:32]
