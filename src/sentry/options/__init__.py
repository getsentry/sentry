from typing import Any, cast

from django.core.signals import request_finished

from sentry.options.manager import DEFAULT_KEY_TTL
from sentry.utils.local_cache import Cache, TTLCache

from .manager import (
    FLAG_ADMIN_MODIFIABLE,
    FLAG_ALLOW_EMPTY,
    FLAG_AUTOMATOR_MODIFIABLE,
    FLAG_BOOL,
    FLAG_CREDENTIAL,
    FLAG_IMMUTABLE,
    FLAG_MODIFIABLE_BOOL,
    FLAG_MODIFIABLE_RATE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    FLAG_RATE,
    FLAG_REQUIRED,
    FLAG_SCALAR,
    FLAG_STOREONLY,
    NotWritableReason,
    OptionsManager,
    UnknownOption,
    UpdateChannel,
)
from .store import OptionsStore

__all__ = (
    "FLAG_ADMIN_MODIFIABLE",
    "FLAG_ALLOW_EMPTY",
    "FLAG_BOOL",
    "FLAG_IMMUTABLE",
    "FLAG_MODIFIABLE_BOOL",
    "FLAG_MODIFIABLE_RATE",
    "FLAG_NOSTORE",
    "FLAG_PRIORITIZE_DISK",
    "FLAG_RATE",
    "FLAG_REQUIRED",
    "FLAG_SCALAR",
    "FLAG_STOREONLY",
    "FLAG_AUTOMATOR_MODIFIABLE",
    "FLAG_CREDENTIAL",
    "NotWritableReason",
    "UnknownOption",
    "UpdateChannel",
    "can_update",
    "default_store",
    "delete",
    "get",
    "get_last_update_channel",
    "isset",
    "lookup_key",
    "register",
    "unregister",
    "set",
    "OptionsManager",
)

# See notes in ``runner.initializer`` regarding lazy cache configuration.
default_store = OptionsStore(cache=None)
request_finished.connect(default_store.maybe_clean_local_cache)

default_manager = OptionsManager(store=default_store)

# expose public API
get = default_manager.get
set = default_manager.set
delete = default_manager.delete
register = default_manager.register
unregister = default_manager.unregister
all = default_manager.all
filter = default_manager.filter
isset = default_manager.isset
is_set_on_disk = default_manager.is_set_on_disk
lookup_key = default_manager.lookup_key
get_last_update_channel = default_manager.get_last_update_channel
can_update = default_manager.can_update


def load_defaults() -> None:
    from sentry.hybridcloud import options  # NOQA

    from . import defaults  # NOQA


# This cache is thread-unsafe mirroring the behavior of the options cache. The options
# cache notes Python's GIL as the serialization provider. Race conditions produce
# redundant network calls but do not otherwise err.
#
# This cache is unbounded mirroring the behavior of the options cache.
__get_fast_cache: TTLCache[str, Any] = TTLCache(
    cast(Cache[str, tuple[int, Any]], {}), ttl=DEFAULT_KEY_TTL + 1
)


def get_fast(key: str, silent: bool = False) -> Any:
    """
    Get the value of an option, falling back to the local configuration.

    If no value is present for the key, the default Option value is returned.

    The default options "get" method logs, emits a metric, contains four levels of
    indrection and allocations a set and dictionary. These are unnecessary operations
    which may need to be skipped in select high-throughput environments.

    Though this function is faster than the default "get" function the fastest
    alternative is to cache your calls to "options.get" in a local variable, outside
    your loop, and use the local. This function captures 90% of the performance
    benefit with 1% the effort (find and replace).

    >>> from sentry import options
    >>> options.get_fast('option')
    """
    try:
        return __get_fast_cache[key]
    except KeyError:
        v = __get_fast_cache[key] = get(key, silent)
        return v
