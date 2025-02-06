from __future__ import annotations

import itertools
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import timedelta
from typing import Generic

import pytest

from sentry.utils.kvstore.abstract import K, KVStorage, V


@dataclass
class Properties(Generic[K, V]):
    store: KVStorage[K, V]
    keys: Iterator[K]
    values: Iterator[V]

    @property
    def items(self) -> Iterator[tuple[K, V]]:
        return zip(self.keys, self.values)


@pytest.fixture(params=["bigtable", "cache/default", "memory", "memory+cachewrapper", "redis"])
def properties(request) -> Properties:
    if request.param == "bigtable":
        from tests.sentry.utils.kvstore.test_bigtable import create_store

        return Properties(
            create_store(request),
            keys=(f"{i}" for i in itertools.count()),
            values=(f"{i}".encode() for i in itertools.count()),
        )
    elif request.param.startswith("cache/"):
        from sentry.utils.kvstore.cache import CacheKVStorage

        # XXX: Currently only testing against the default cache is supported
        # because testing against the Redis cache requires complex mocking of
        # global state in ``sentry.utils.redis``.
        [backend_label] = request.param.split("/")[1:]
        if backend_label == "default":
            from sentry.cache import default_cache as cache
        else:
            raise AssertionError("unknown cache backend label")

        return Properties(
            CacheKVStorage(cache),
            keys=(f"kvstore/{i}" for i in itertools.count()),
            values=itertools.count(),
        )
    elif request.param == "memory":
        from sentry.utils.kvstore.memory import MemoryKVStorage

        return Properties(
            MemoryKVStorage(),
            keys=itertools.count(),
            values=itertools.count(),
        )
    elif request.param == "redis":
        from redis import Redis

        from sentry.utils.kvstore.redis import RedisKVStorage

        return Properties(
            RedisKVStorage(Redis(db=6)),
            keys=(f"kvstore/{i}" for i in itertools.count()),
            values=(f"{i}".encode() for i in itertools.count()),
        )
    elif request.param == "memory+cachewrapper":
        from sentry.utils.kvstore.cache import CacheKeyWrapper
        from sentry.utils.kvstore.memory import MemoryKVStorage

        return Properties(
            CacheKeyWrapper(MemoryKVStorage()),
            keys=map(str, itertools.count()),
            values=itertools.count(),
        )
    else:
        raise AssertionError("unknown kvstore label")


def test_single_key_operations(properties: Properties) -> None:
    store = properties.store
    key, value = next(properties.keys), next(properties.values)

    # Test setting a key with no prior value.
    store.set(key, value)
    assert store.get(key) == value

    # Test overwriting a key with a prior value.
    new_value = next(properties.values)
    store.set(key, new_value)
    assert store.get(key) == new_value

    # Test overwriting a key with a new TTL.
    new_value = next(properties.values)
    store.set(key, new_value, ttl=timedelta(seconds=30))
    assert store.get(key) == new_value

    # Test deleting an existing key.
    store.delete(key)
    assert store.get(key) is None

    # Test reading a missing key.
    missing_key = next(properties.keys)
    assert store.get(missing_key) is None

    # Test deleting a missing key.
    store.delete(missing_key)


def test_multiple_key_operations(properties: Properties) -> None:
    store = properties.store

    items = dict(itertools.islice(properties.items, 10))
    for key, value in items.items():
        store.set(key, value)

    missing_keys = set(itertools.islice(properties.keys, 5))

    all_keys = list(items.keys() | missing_keys)

    # Test reading a combination of present and missing keys.
    assert dict(store.get_many(all_keys)) == items

    # Test deleting a combination of present and missing keys.
    store.delete_many(all_keys)

    assert dict(store.get_many(all_keys)) == {}
