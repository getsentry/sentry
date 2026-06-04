from sentry.cache import default_cache

from .base import BaseAttachmentCache


class DefaultAttachmentCache(BaseAttachmentCache):
    def __init__(self, **options):
        super().__init__(default_cache, **options)
