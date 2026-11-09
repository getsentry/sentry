from __future__ import annotations

from typing import Any
from uuid import uuid4

from redis.client import StrictRedis
from sentry_redis_tools.clients import RedisCluster

from sentry import options
from sentry.exceptions import InvalidConfiguration
from sentry.utils import redis
from sentry.utils.locking.backends import LockBackend

delete_lock = redis.load_redis_script("utils/locking/delete_lock.lua")


class BaseRedisLockBackend(LockBackend):
    def __init__(
        self,
        cluster: RedisCluster[str] | StrictRedis[str],
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
        delete_lock((self.prefix_key(key),), (self.uuid,), client)

    def locked(self, key: str, routing_key: str | None = None) -> bool:
        client = self.get_client(key, routing_key)
        return client.get(self.prefix_key(key)) is not None


def _get_redis_cluster_for_locks(cluster_name: str) -> RedisCluster[str] | StrictRedis[str]:
    try:
        return redis.redis_clusters.get(cluster_name)
    except KeyError as e:
        if cluster_name not in options.get("redis.clusters"):
            raise
        # This is here specifically to inform self-hosted folks about what's going
        # on when they have 2+ hosts but no is_redis_cluster. Without the nicer error
        # the process fails with a KeyError that isn't helpful
        raise InvalidConfiguration(
            f"Redis cluster {cluster_name!r} cannot be used by RedisClusterLockBackend. "
            "The lock backend needs a cluster with exactly one host, or a cluster "
            "with is_redis_cluster set to True."
        ) from e


class RedisClusterLockBackend(BaseRedisLockBackend):
    cluster: RedisCluster[str] | StrictRedis[str]

    def __init__(
        self,
        cluster: str | RedisCluster[str] | StrictRedis[str],
        prefix: str = "l:",
        uuid: str | None = None,
    ):
        if isinstance(cluster, str):
            cluster = _get_redis_cluster_for_locks(cluster)
        super().__init__(cluster, prefix=prefix, uuid=uuid)

    def get_client(
        self, key: str, routing_key: int | str | None = None
    ) -> RedisCluster[str] | StrictRedis[str]:
        return self.cluster


# Old configs name this path. On a single host it uses the same server and keys as the old
# redis-blaster backend.
RedisLockBackend = RedisClusterLockBackend
