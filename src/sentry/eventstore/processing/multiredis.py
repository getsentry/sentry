from datetime import timedelta
from typing import TypeVar

from rediscluster import RedisCluster

from sentry.utils.codecs import JSONCodec
from sentry.utils.kvstore.encoding import KVStorageCodecWrapper
from sentry.utils.kvstore.redis import RedisKVStorage
from sentry.utils.redis import redis_clusters

from .base import EventProcessingStore

T = TypeVar("T", str, bytes)


class MultiRedisProcessingStore(EventProcessingStore):
    """
    Adapter to shift traffic from one redis cluster to another
    """

    def __init__(self, **options):
        inner = MultiRedisKVStorage(
            old_cluster=redis_clusters.get(options["old_cluster"]),
            new_cluster=redis_clusters.get(options["new_cluster"]),
        )
        super().__init__(KVStorageCodecWrapper(inner, JSONCodec()))


class MultiRedisKVStorage(RedisKVStorage[T]):
    def __init__(self, old_cluster: RedisCluster, new_cluster: RedisCluster) -> None:
        self.old_cluster = old_cluster
        self.new_cluster = new_cluster

    def get(self, key: str) -> T | None:
        str_key = key.encode("utf8")
        new_val = self.new_cluster.get(str_key)
        if new_val is not None:
            return new_val
        return self.old_cluster.get(str_key)

    def set(self, key: str, value: T, ttl: timedelta | None = None) -> None:
        self.new_cluster.set(key.encode("utf8"), value, ex=ttl)

    def delete(self, key: str) -> None:
        str_key = key.encode("utf8")
        self.new_cluster.delete(str_key)
        self.old_cluster.delete(str_key)

    def bootstrap(self) -> None:
        pass  # nothing to do

    def destroy(self) -> None:
        self.old_cluster.flushdb()
        self.new_cluster.flushdb()
