from __future__ import annotations

import hashlib
import random

from sentry import options


def in_random_rollout(option_name: str) -> bool:
    """
    Determine if the current operation is in a random % based rollout
    group governed by an option with `option_name`.
    """
    return random.random() < options.get(option_name)


def in_rollout_group(option_name: str, key: int | str) -> bool:
    """
    Determine if the current `key` expression is in a deterministic % based rollout
    group governed by an option with `option_name`
    """
    if isinstance(key, str):
        int_key = int(hashlib.md5(key.encode("utf8")).hexdigest(), base=16)
    else:
        int_key = key
    return (int_key % 100000) / 100000 < options.get(option_name)
