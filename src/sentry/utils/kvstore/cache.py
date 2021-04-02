from datetime import timedelta
from typing import Any, Optional

from sentry.cache.base import BaseCache
from sentry.utils.kvstore.abstract import KVStorage


class CacheKVStorage(KVStorage[Any, Any]):
    """
    This class implements a compatibility layer for code that was previously
    storing key/value data one of the various cache backends.

    This class is only intended to aid in the migration of existing code and
    data, new functionality that doesn't require interopability with or
    migration from existing implementations should use a more well-formed
    backend specific to their purposes.
    """

    # NOTE: Several untyped calls to ``BaseCache`` are ignored in this class
    # because the existing cache implementations have extremely flexible
    # parameter types to begin with (e.g. anything that can be formatted to a
    # string can be considered a valid key) and different backends have various
    # value encoding strategies that are not always compatible (generally
    # pickle and JSON.)

    def __init__(self, backend: BaseCache) -> None:
        self.backend = backend

    def get(self, key: Any) -> Optional[Any]:
        return self.backend.get(key)

    def set(self, key: Any, value: Any, ttl: Optional[timedelta] = None) -> None:
        self.backend.set(key, value, timeout=int(ttl.total_seconds()) if ttl is not None else None)

    def delete(self, key: Any) -> None:
        self.backend.delete(key)

    def bootstrap(self) -> None:
        # Nothing to do in this method: the backend is expected to either not
        # require any explicit setup action (memcached, Redis) or that setup is
        # assumed to be managed elsewhere (e.g. the Django database cache is
        # managed by the migration framework) in both deployment and testing
        # environments.
        pass

    def destroy(self) -> None:
        # Nothing to do in this method: this backend is expected to be torn
        # down in tests by the test runner machinery. Hopefully you're not
        # running this against a real deployment (it could be helpful to
        # destroy a development environment, though.)
        pass
