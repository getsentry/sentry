from __future__ import annotations

import hashlib
from typing import Any

from django.db import router, transaction

from sentry.monitors.models import MonitorCheckInConfig
from sentry.utils import json

# Maps config hash -> MonitorCheckInConfig id. Rows are immutable, so entries
# never go stale.
_config_id_cache: dict[str, int] = {}
_CONFIG_ID_CACHE_MAX_SIZE = 10_000


def hash_checkin_config(config: dict[str, Any]) -> str:
    canonical = json.dumps(config, sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _cache_config_id(config_hash: str, config_id: int) -> None:
    if len(_config_id_cache) >= _CONFIG_ID_CACHE_MAX_SIZE:
        _config_id_cache.clear()
    _config_id_cache[config_hash] = config_id


def clear_checkin_config_cache() -> None:
    _config_id_cache.clear()


def get_checkin_config_id(config: dict[str, Any]) -> int:
    """
    Returns the id of the MonitorCheckInConfig row holding this config,
    creating it if needed.
    """
    config_hash = hash_checkin_config(config)
    cached_id = _config_id_cache.get(config_hash)
    if cached_id is not None:
        return cached_id

    checkin_config, created = MonitorCheckInConfig.objects.get_or_create(
        hash=config_hash, defaults={"config": config}
    )

    if created:
        # Only cache once committed, so a rolled back row is never cached.
        transaction.on_commit(
            lambda: _cache_config_id(config_hash, checkin_config.id),
            using=router.db_for_write(MonitorCheckInConfig),
        )
    else:
        _cache_config_id(config_hash, checkin_config.id)

    return checkin_config.id
