from __future__ import absolute_import

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

    def set(self, key, value, timeout, version=None, raw=False):
        key = self.make_key(key, version=version)
        v = json.dumps(value) if not raw else value
        if len(v) > self.max_size:
            raise ValueTooLarge("Cache key too large: %r %r" % (key, len(v)))
        if timeout:
            self.client.setex(key, int(timeout), v)
        else:
            self.client.set(key, v)

    def delete(self, key, version=None):
        key = self.make_key(key, version=version)
        self.client.delete(key)

    def get(self, key, version=None, raw=False):
        key = self.make_key(key, version=version)
        result = self.client.get(key)
        if result is not None and not raw:
            result = json.loads(result)
        return result


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
