from __future__ import annotations

from typing import cast

from redis.client import StrictRedis
from sentry_redis_tools.clients import RedisCluster

from sentry.exceptions import MissingTTL
from sentry.utils import json
from sentry.utils.redis import redis_clusters

from .base import BaseCache


class ValueTooLarge(Exception):
    pass


class CommonRedisCache(BaseCache):
    key_expire = 60 * 60  # 1 hour
    max_size = 50 * 1024 * 1024  # 50MB

    def __init__(
        self,
        client: RedisCluster[str] | StrictRedis[str],
        raw_client: RedisCluster[bytes] | StrictRedis[bytes],
        version: int | None = None,
        prefix: str | None = None,
        is_default_cache: bool = False,
    ) -> None:
        self._text_client = client
        self._bytes_client = raw_client
        super().__init__(version=version, prefix=prefix, is_default_cache=is_default_cache)

    def _client(
        self, *, raw: bool
    ) -> RedisCluster[str] | StrictRedis[str] | RedisCluster[bytes] | StrictRedis[bytes]:
        if raw:
            return self._bytes_client
        else:
            return self._text_client

    def set(
        self,
        key: str,
        value: object,
        timeout: int | float | None,
        version: int | None = None,
        raw: bool = False,
    ) -> None:
        key = self.make_key(key, version=version)
        if not timeout:
            raise MissingTTL(key)

        if raw:
            v = cast(str | bytes, value)
        else:
            v = json.dumps(value)

        if len(v) > self.max_size:
            raise ValueTooLarge(f"Cache key too large: {key!r} {len(v)!r}")

        self._client(raw=raw).setex(key, int(timeout), v)

        self._mark_transaction("set")

    def delete(self, key: str, version: int | None = None) -> None:
        key = self.make_key(key, version=version)
        self._client(raw=False).delete(key)

        self._mark_transaction("delete")

    def get(self, key: str, version: int | None = None, raw: bool = False) -> object:
        key = self.make_key(key, version=version)
        result = self._client(raw=raw).get(key)
        if result is not None and not raw:
            result = json.loads(result)

        self._mark_transaction("get")

        return result


class RedisClusterCache(CommonRedisCache):
    def __init__(
        self,
        cluster_id: str = "default",
        version: int | None = None,
        prefix: str | None = None,
        is_default_cache: bool = False,
    ) -> None:
        client = redis_clusters.get(cluster_id)
        raw_client = redis_clusters.get_binary(cluster_id)
        super().__init__(
            client=client,
            raw_client=raw_client,
            version=version,
            prefix=prefix,
            is_default_cache=is_default_cache,
        )


# Deploy configs refer to both names by string.
RedisCache = RedisClusterCache
