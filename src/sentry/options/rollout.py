from __future__ import annotations

import hashlib
import random
from collections.abc import Iterable

from sentry import options

BUCKETS = 100000


def in_random_rollout(option_name: str) -> bool:
    """
    Determine if the current operation is in a random % based rollout
    group governed by an option with `option_name`.
    """
    return random.random() < options.get(option_name)


def _bucket(key: int | str) -> int:
    if isinstance(key, str):
        key = int(hashlib.md5(key.encode("utf8")).hexdigest(), base=16)
    return key % BUCKETS


def in_rollout_group(option_name: str, key: int | str) -> bool:
    """
    Determine if the current `key` expression is in a deterministic % based rollout
    group governed by an option with `option_name`
    """
    return _bucket(key) / BUCKETS < options.get(option_name)


def in_rollout_group_batch[K: (int, str)](option_name: str, keys: Iterable[K]) -> list[K]:
    """
    The keys of `keys` that are in the rollout group governed by `option_name`.

    Same membership as calling ``in_rollout_group`` per key, but the option is read
    once for the whole batch rather than once per key. That read dominates the cost
    at scale: over a million keys it is the difference between seconds and
    milliseconds.
    """
    rate = options.get(option_name)
    return [key for key in keys if _bucket(key) / BUCKETS < rate]
