from __future__ import annotations

import hashlib
from typing import Any

from sentry.monitors.models import MonitorCheckInConfig
from sentry.utils import json
from sentry.utils.local_cache import LRUCache, ThreadSafeCache

# Maps config hash -> MonitorCheckInConfig id. Rows are immutable, so entries
# never go stale.
_config_ids: ThreadSafeCache[str, int] = ThreadSafeCache(LRUCache(maxlen=10_000))


def hash_checkin_config(config: dict[str, Any]) -> str:
    canonical = json.dumps(config, sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def clear_checkin_config_cache() -> None:
    for key in list(_config_ids.keys()):
        _config_ids.pop(key)


def get_checkin_config_id(config: dict[str, Any]) -> int:
    """
    Returns the id of the MonitorCheckInConfig row holding this config,
    creating it if needed.

    Call this outside a transaction: the model cache is written when the row
    is saved, so a rolled back row would stay cached.
    """
    config_hash = hash_checkin_config(config)
    config_id = _config_ids.get(config_hash)
    if config_id is not None:
        return config_id

    try:
        config_id = MonitorCheckInConfig.objects.get_from_cache(hash=config_hash).id
    except MonitorCheckInConfig.DoesNotExist:
        config_id = MonitorCheckInConfig.objects.get_or_create(
            hash=config_hash, defaults={"config": config}
        )[0].id

    _config_ids[config_hash] = config_id
    return config_id
