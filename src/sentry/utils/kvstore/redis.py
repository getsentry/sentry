from __future__ import annotations

from datetime import timedelta
from typing import Optional, TypeVar

from redis import StrictRedis
from rediscluster import RedisCluster

from sentry.utils.kvstore.abstract import KVStorage

T = TypeVar("T", str, bytes)


class RedisKVStorage(KVStorage[str, T]):
    """
    This class provides a key/value store backed by Redis (either a single node
    or cluster.)
    """

    def __init__(self, client: StrictRedis[T] | RedisCluster[T]) -> None:
        self.client: StrictRedis[T] | RedisCluster[T] = client

    def get(self, key: str) -> Optional[T]:
        return self.client.get(key.encode("utf8"))

    def set(self, key: str, value: T, ttl: Optional[timedelta] = None) -> None:
        self.client.set(key.encode("utf8"), value, ex=ttl)

    def delete(self, key: str) -> None:
        self.client.delete(key.encode("utf8"))

    def bootstrap(self) -> None:
        pass  # nothing to do

    def destroy(self) -> None:
        self.client.flushdb()
