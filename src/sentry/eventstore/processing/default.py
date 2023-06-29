from sentry.cache import default_cache
from sentry.utils.kvstore.cache import CacheKVStorage

from .base import EventProcessingStore


def DefaultEventProcessingStore() -> EventProcessingStore:
    """
    Creates an instance of the processing store which uses the
    ``default_cache`` as its backend.
    """
    return EventProcessingStore(CacheKVStorage(default_cache))
