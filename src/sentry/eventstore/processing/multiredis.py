import hashlib
from datetime import timedelta
from typing import TypeVar

from redis.cluster import RedisCluster

from sentry import options
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

    def __init__(self, old_cluster: str, new_cluster: str):
        inner = MultiRedisKVStorage(
            old_cluster=redis_clusters.get(old_cluster),  # type: ignore[arg-type]
            new_cluster=redis_clusters.get(new_cluster),  # type: ignore[arg-type]
        )
        super().__init__(KVStorageCodecWrapper(inner, JSONCodec()))


class MultiRedisKVStorage(RedisKVStorage[T]):
    def __init__(self, old_cluster: RedisCluster, new_cluster: RedisCluster) -> None:
        self.old_cluster = old_cluster
        self.new_cluster = new_cluster

    def use_new(self, key: bytes):
        rollout = options.get("eventstore.processing.rollout")
        intkey = int(hashlib.md5(key).hexdigest(), base=16)
        return (intkey % 10000) / 10000 < rollout

    def get(self, key: str) -> T | None:
        bkey = key.encode("utf8")
        if self.use_new(bkey):
            val = self.new_cluster.get(bkey)
            if val is None and options.get("eventstore.processing.readold"):
                val = self.old_cluster.get(bkey)
            return val
        else:
            val = self.old_cluster.get(bkey)
            if val is None:
                val = self.new_cluster.get(bkey)
            return val

    def set(self, key: str, value: T, ttl: timedelta | None = None) -> None:
        bkey = key.encode("utf8")
        if self.use_new(bkey):
            self.new_cluster.set(bkey, value, ex=ttl)
        else:
            self.old_cluster.set(bkey, value, ex=ttl)

    def delete(self, key: str) -> None:
        bkey = key.encode("utf8")
        self.new_cluster.delete(bkey)
        if options.get("eventstore.processing.readold"):
            self.old_cluster.delete(bkey)

    def bootstrap(self) -> None:
        pass  # nothing to do

    def destroy(self) -> None:
        self.old_cluster.flushdb()
        self.new_cluster.flushdb()
