from __future__ import absolute_import

from sentry.cache import default_cache

from .base import BaseEventProcessingStore


class DefaultEventProcessingStore(BaseEventProcessingStore):
    """
    Default implementation of processing store which uses the `default_cache`
    as backend.
    """

    def __init__(self, **options):
        super(DefaultEventProcessingStore, self).__init__(inner=default_cache, **options)
