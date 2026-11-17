from collections.abc import Mapping
from typing import Any

from django.conf import settings

from sentry.utils import warnings
from sentry.utils.services import LazyServiceWrapper

from .base import BaseTSDB
from .dummy import DummyTSDB

LEGACY_BACKEND = "sentry.tsdb.redissnuba.RedisSnubaTSDB"
SNUBA_BACKEND = "sentry.tsdb.snuba.SnubaTSDB"


def resolve_backend(path: str, options: Mapping[str, Any]) -> tuple[str, Mapping[str, Any]]:
    # Not in apply_legacy_settings(): django.setup() imports this module first, and the
    # wrapper keeps the path it's given.
    if path != LEGACY_BACKEND:
        return path, options
    warnings.warn(warnings.DeprecatedSettingWarning(LEGACY_BACKEND, SNUBA_BACKEND))
    options = dict(options)
    # RedisSnubaTSDB took SnubaTSDB's options nested under "snuba".
    snuba = options.pop("snuba", None) or {}
    return SNUBA_BACKEND, dict(**snuba, **options)


backend = LazyServiceWrapper(
    BaseTSDB,
    *resolve_backend(settings.SENTRY_TSDB, settings.SENTRY_TSDB_OPTIONS),
    dangerous=[DummyTSDB],
)
backend.expose(locals())
