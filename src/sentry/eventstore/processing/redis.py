import logging

from .base import BaseEventProcessingStore
from sentry.cache.redis import RedisClusterCache

logger = logging.getLogger(__name__)


class RedisClusterEventProcessingStore(BaseEventProcessingStore):
    """
    Processing store implementation using the redis cluster cache as a backend.
    """

    def __init__(self, **options):
        super().__init__(inner=RedisClusterCache(**options))
