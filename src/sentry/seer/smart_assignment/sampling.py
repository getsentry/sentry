"""Deterministic sampling for the smart assignment feature.

Sampling is keyed on the group id via a stable hash (not Python's salted
``hash()``), so a given issue is consistently in or out of the sample across
processes and retries.
"""

from __future__ import annotations

import hashlib

_MAX_UINT64 = 2**64


def should_sample(group_id: int, rate: float) -> bool:
    """Return True if `group_id` falls in the sampled fraction `rate` (0.0-1.0)."""
    if rate <= 0.0:
        return False
    if rate >= 1.0:
        return True
    digest = hashlib.md5(f"smart_assignment:{group_id}".encode()).digest()
    bucket = int.from_bytes(digest[:8], "big") / _MAX_UINT64
    return bucket < rate
