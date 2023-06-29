from sentry.cache import default_cache
from sentry.utils.kvstore.cache import CacheKVStorage

from .base import EventProcessingStore


class DefaultEventProcessingStore(EventProcessingStore):
    def __init__(self) -> None:
        """
        Creates an instance of the processing store which uses the
        ``default_cache`` as its backend.
        """
        super().__init__(CacheKVStorage(default_cache))
