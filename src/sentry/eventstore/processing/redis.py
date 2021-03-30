from sentry.cache.redis import RedisClusterCache
from sentry.utils.kvstore.cache import CacheKVStorage

from .base import EventProcessingStore


def RedisClusterEventProcessingStore(**options) -> EventProcessingStore:
    """
    Creates an instance of the processing store which uses the Redis Cluster
    cache as its backend.
    """
    return EventProcessingStore(CacheKVStorage(RedisClusterCache(**options)))
