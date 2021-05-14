from datetime import timedelta
from typing import Any, Iterator, Optional, Sequence, Tuple

from django.conf import settings

from sentry.cache.base import BaseCache, unwrap_key, wrap_key
from sentry.utils.kvstore.abstract import KVStorage, V


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


class CacheKeyWrapper(KVStorage[str, V]):
    """
    This class implements a compatibility layer for interacting with storages
    that have existing data written with cache key prefixes.
    """

    # XXX: ``keys`` must be ``str`` to avoid type mismatches when returning
    # unwrapped values (e.g. from ``get_many``), even though the write path
    # would accept ``Any`` type.

    def __init__(
        self,
        storage: KVStorage[str, V],
        prefix: str = BaseCache.prefix,
        version: Optional[Any] = None,
    ):
        if version is None:
            version = settings.CACHE_VERSION

        self.storage = storage
        self.prefix = prefix
        self.version = version

    def get(self, key: str) -> Optional[V]:
        return self.storage.get(wrap_key(self.prefix, self.version, key))

    def get_many(self, keys: Sequence[str]) -> Iterator[Tuple[str, V]]:
        results = self.storage.get_many([wrap_key(self.prefix, self.version, key) for key in keys])
        for key, value in results:
            yield unwrap_key(self.prefix, self.version, key), value

    def set(self, key: str, value: V, ttl: Optional[timedelta] = None) -> None:
        return self.storage.set(
            wrap_key(self.prefix, self.version, key),
            value,
            ttl,
        )

    def delete(self, key: str) -> None:
        self.storage.delete(wrap_key(self.prefix, self.version, key))

    def delete_many(self, keys: Sequence[str]) -> None:
        return self.storage.delete_many([wrap_key(self.prefix, self.version, key) for key in keys])

    def bootstrap(self) -> None:
        self.storage.bootstrap()

    def destroy(self) -> None:
        # ``destroy`` is not implemented since the cache key prefix implies this
        # is a shared keyspace, and suggests that this may cause collateral
        # damage to other storage instances
        raise NotImplementedError
