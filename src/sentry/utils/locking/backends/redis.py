from typing import Any
from uuid import uuid4

import rb
from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry.utils import redis
from sentry.utils.locking.backends import LockBackend

delete_lock = redis.load_script("utils/locking/delete_lock.lua")


class BaseRedisLockBackend(LockBackend):
    def __init__(
        self,
        cluster: RedisCluster | rb.Cluster | StrictRedis,
        prefix: str = "l:",
        uuid: str | None = None,
    ):
        if uuid is None:
            uuid = uuid4().hex
        self.prefix = prefix
        self.uuid = uuid
        self.cluster = cluster

    def get_client(self, key: str, routing_key: int | str | None = None) -> Any:
        raise NotImplementedError

    def prefix_key(self, key: str) -> str:
        return f"{self.prefix}{key}"

    def acquire(self, key: str, duration: int, routing_key: str | None = None) -> None:
        client = self.get_client(key, routing_key)
        full_key = self.prefix_key(key)
        if client.set(full_key, self.uuid, ex=duration, nx=True) is not True:
            raise Exception(f"Could not set key: {full_key!r}")

    def release(self, key: str, routing_key: str | None = None) -> None:
        client = self.get_client(key, routing_key)
        delete_lock(client, (self.prefix_key(key),), (self.uuid,))

    def locked(self, key: str, routing_key: str | None = None) -> bool:
        client = self.get_client(key, routing_key)
        return client.get(self.prefix_key(key)) is not None


class RedisBlasterLockBackend(BaseRedisLockBackend):
    cluster: rb.Cluster

    def __init__(self, cluster: str | rb.Cluster, prefix: str = "l:", uuid: str | None = None):
        if isinstance(cluster, str):
            cluster = redis.clusters.get(cluster)
        super().__init__(cluster, prefix=prefix, uuid=uuid)

    def get_client(self, key: str, routing_key: int | str | None = None) -> rb.clients.LocalClient:
        # This is a bit of an abstraction leak, but if an integer is provided
        # we use that value to determine placement rather than the cluster
        # router. This leaking allows us us to have more fine-grained control
        # when data is already placed within partitions where the router
        # wouldn't have placed it based on the key hash, and maintain data
        # locality and failure isolation within those partitions. (For example,
        # the entirety of a digest is bound to a specific partition by the
        # *digest* key, even though a digest is composed of multiple values at
        # different keys that would otherwise be placed on different
        # partitions.)
        if isinstance(routing_key, int):
            index = routing_key % len(self.cluster.hosts)
            return self.cluster.get_local_client(index)

        if routing_key is not None:
            key = routing_key
        else:
            key = self.prefix_key(key)

        return self.cluster.get_local_client_for_key(key)


class RedisClusterLockBackend(BaseRedisLockBackend):
    cluster: RedisCluster | StrictRedis

    def __init__(
        self, cluster: str | RedisCluster | StrictRedis, prefix: str = "l:", uuid: str | None = None
    ):
        if isinstance(cluster, str):
            cluster = redis.redis_clusters.get(cluster)
        super().__init__(cluster, prefix=prefix, uuid=uuid)

    def get_client(
        self, key: str, routing_key: int | str | None = None
    ) -> RedisCluster | StrictRedis:
        return self.cluster


RedisLockBackend = RedisBlasterLockBackend
