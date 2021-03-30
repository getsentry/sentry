from sentry.cache import default_cache
from sentry.utils.kvstore.cache import CacheKVStorage

from .base import BaseEventProcessingStore


class DefaultEventProcessingStore(BaseEventProcessingStore):
    """
    Default implementation of processing store which uses the `default_cache`
    as backend.
    """

    def __init__(self, **options) -> None:
        super().__init__(inner=CacheKVStorage(default_cache), **options)
