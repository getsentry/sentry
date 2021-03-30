from sentry.cache.redis import RedisClusterCache
from sentry.utils.kvstore.cache import CacheKVStorage

from .base import EventProcessingStore


class RedisClusterEventProcessingStore(EventProcessingStore):
    """
    Processing store implementation using the redis cluster cache as a backend.
    """

    def __init__(self, **options) -> None:
        super().__init__(inner=CacheKVStorage(RedisClusterCache(**options)))
