from typing import Any, List, Optional, Tuple

from sentry.utils import json
from sentry.utils.redis import get_cluster_from_options, redis_clusters

from .base import BaseCache


class ValueTooLarge(Exception):
    pass


class CommonRedisCache(BaseCache):
    key_expire = 60 * 60  # 1 hour
    max_size = 50 * 1024 * 1024  # 50MB

    def __init__(self, client, **options):
        self.client = client
        BaseCache.__init__(self, **options)

    def set(self, key, value, timeout, version=None, raw=False, pipeline=None):
        client = pipeline or self.client

        key = self.make_key(key, version=version)
        v = json.dumps(value) if not raw else value
        if len(v) > self.max_size:
            raise ValueTooLarge(f"Cache key too large: {key!r} {len(v)!r}")
        if timeout:
            client.setex(key, int(timeout), v)
        else:
            client.set(key, v)

        self._mark_transaction("set")

    def multi_set(
        self,
        payload: Tuple[str, Any],
        timeout: int,
        version: Optional[str] = None,
        raw: bool = False,
    ) -> None:
        """Set multiple keys in Redis with an expiry."""
        pipeline = self.client.pipeline()
        for key, value in payload:
            self.set(key, value, timeout, version=version, raw=raw, pipeline=pipeline)
        pipeline.execute()

    def delete(self, key, version=None):
        key = self.make_key(key, version=version)
        self.client.delete(key)

        self._mark_transaction("delete")

    def multi_delete(self, keys, version=None):
        formatted_keys = [self.make_key(key, version=version) for key in keys]
        self.client.delete(formatted_keys, version)

        self._mark_transaction("multi_delete")

    def get(self, key, version=None, raw=False):
        key = self.make_key(key, version=version)
        result = self.client.get(key)
        if result is not None and not raw:
            result = json.loads(result)

        self._mark_transaction("get")

        return result

    def multi_get(self, keys: List[str], version: Optional[str] = None, raw: bool = False):
        """Fetch multiple keys from Redis."""
        formatted_keys: List[str] = [self.make_key(key, version=version) for key in keys]
        results: List[Optional[bytes]] = self.client.mget(formatted_keys)

        if raw:
            formatted_results = [result.decode("utf-8") if result else None for result in results]
        else:
            formatted_results = [json.loads(result) if result else None for result in results]

        self._mark_transaction("mget")
        return formatted_results


class RbCache(CommonRedisCache):
    def __init__(self, **options):
        cluster, options = get_cluster_from_options("SENTRY_CACHE_OPTIONS", options)
        client = cluster.get_routing_client()
        CommonRedisCache.__init__(self, client, **options)


# Confusing legacy name for RbCache.  We don't actually have a pure redis cache
RedisCache = RbCache


class RedisClusterCache(CommonRedisCache):
    def __init__(self, cluster_id, **options):
        client = redis_clusters.get(cluster_id)
        CommonRedisCache.__init__(self, client=client, **options)
