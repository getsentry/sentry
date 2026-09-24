from typing import Any

from sentry.exceptions import MissingTTL
from sentry.utils import json
from sentry.utils.redis import get_cluster_from_options, get_cluster_routing_client, redis_clusters

from .base import BaseCache


class ValueTooLarge(Exception):
    pass


class CommonRedisCache(BaseCache):
    key_expire = 60 * 60  # 1 hour
    max_size = 50 * 1024 * 1024  # 50MB

    def __init__(self, client, raw_client, **options):
        self._text_client = client
        self._bytes_client = raw_client
        super().__init__(**options)

    def _client(self, *, raw: bool):
        if raw:
            return self._bytes_client
        else:
            return self._text_client

    def set(self, key, value, timeout, version=None, raw=False):
        key = self.make_key(key, version=version)
        if not timeout:
            raise MissingTTL(key)

        if raw:
            v = value
        else:
            v = json.dumps(value)

        if len(v) > self.max_size:
            raise ValueTooLarge(f"Cache key too large: {key!r} {len(v)!r}")

        self._client(raw=raw).setex(key, int(timeout), v)

        self._mark_transaction("set")

    def delete(self, key, version=None):
        key = self.make_key(key, version=version)
        self._client(raw=False).delete(key)

        self._mark_transaction("delete")

    def get(self, key, version=None, raw=False):
        key = self.make_key(key, version=version)
        result = self._client(raw=raw).get(key)
        if result is not None and not raw:
            result = json.loads(result)

        self._mark_transaction("get")

        return result


def _get_clients(options: dict[str, Any]) -> tuple[Any, Any, dict[str, Any]]:
    if "hosts" not in options:
        cluster_id = options.get("cluster", "default")
        try:
            client = redis_clusters.get(cluster_id)
            raw_client = redis_clusters.get_binary(cluster_id)
        except KeyError:
            pass
        else:
            return client, raw_client, {k: v for k, v in options.items() if k != "cluster"}

    cluster, options = get_cluster_from_options("SENTRY_CACHE_OPTIONS", options)
    rb_client = get_cluster_routing_client(cluster, False)
    # XXX: rb does not have a "raw" client -- use the default client
    return rb_client, rb_client, options


class RbCache(CommonRedisCache):
    def __init__(self, **options: object) -> None:
        client, raw_client, options = _get_clients(options)
        super().__init__(client=client, raw_client=raw_client, **options)


# Legacy name for RbCache. Deploy configs refer to it by string.
RedisCache = RbCache


class RedisClusterCache(CommonRedisCache):
    def __init__(self, cluster_id: str, **options: object) -> None:
        client = redis_clusters.get(cluster_id)
        raw_client = redis_clusters.get_binary(cluster_id)
        super().__init__(client=client, raw_client=raw_client, **options)
