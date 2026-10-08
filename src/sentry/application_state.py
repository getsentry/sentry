"""Application-generated global state, persisted in the existing Option store.

Rows, cache keys, and self-hosted fallback values are shared with legacy option
callers. State never consults the runtime configuration read hook. Project and
organization state belongs in their scoped stores.
"""

from typing import Literal, cast, overload

from django.conf import settings

from sentry.options import default_store
from sentry.options.manager import DEFAULT_FLAGS, UpdateChannel, _make_cache_key
from sentry.options.store import Key
from sentry.utils.types import Any

StringStateKey = Literal[
    "sentry:system-token",
    "sentry:install-id",
    "sentry:latest_version",
    "sentry:last_worker_version",
    "sentry:version-configured",
]
TimestampStateKey = Literal["sentry:last_worker_ping"]
StateKey = StringStateKey | TimestampStateKey

_STRING_KEYS = frozenset(
    {
        "sentry:system-token",
        "sentry:install-id",
        "sentry:latest_version",
        "sentry:last_worker_version",
        "sentry:version-configured",
    }
)


# Use the legacy storage shape so old and new application callers share cached
# values during deployments. A zero TTL keeps state out of the local cache.
def _key(name: StateKey) -> Key:
    if name not in _STRING_KEYS and name != "sentry:last_worker_ping":
        raise ValueError(f"Unknown application state key: {name}")
    return Key(name, lambda: "", Any, DEFAULT_FLAGS, 0, 0, _make_cache_key(name), None)


@overload
def get(name: StringStateKey) -> str: ...


@overload
def get(name: TimestampStateKey) -> float | str: ...


def get(name: StateKey) -> str | float:
    key = _key(name)
    value = default_store.get(key)
    if value is not None:
        return cast(str | float, value)

    # Preserve legacy self-hosted inputs and the empty-string default, including
    # caching misses to avoid repeatedly querying the database.
    if name in settings.SENTRY_OPTIONS:
        value = settings.SENTRY_OPTIONS[name]
    elif name in settings.SENTRY_DEFAULT_OPTIONS:
        value = settings.SENTRY_DEFAULT_OPTIONS[name]
    else:
        value = ""
    default_store.set_cache(key, value)
    return cast(str | float, value)


@overload
def set(name: StringStateKey, value: str) -> bool: ...


@overload
def set(name: TimestampStateKey, value: float) -> bool: ...


def set(name: StateKey, value: str | float) -> bool:
    key = _key(name)
    if name in _STRING_KEYS:
        if not isinstance(value, str):
            raise TypeError(f"Application state {name} requires a string")
    elif not isinstance(value, (int, float)) or isinstance(value, bool):
        raise TypeError(f"Application state {name} requires a timestamp")
    return default_store.set(key, value, channel=UpdateChannel.APPLICATION)


def delete(name: StateKey) -> bool:
    return default_store.delete(_key(name))
