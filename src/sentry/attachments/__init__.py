from __future__ import absolute_import

__all__ = ['attachment_cache', 'CachedAttachment']

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from .base import AttachmentCache, CachedAttachment

if settings.SENTRY_ATTACHMENTS:
    cache_cls = settings.SENTRY_ATTACHMENTS
    options = settings.SENTRY_ATTACHMENTS_OPTIONS
elif settings.SENTRY_CACHE:
    cache_cls = settings.SENTRY_CACHE
    options = settings.SENTRY_CACHE_OPTIONS
else:
    raise ImproperlyConfigured('You must configure ``cache.backend``.')

attachment_cache = AttachmentCache(cache_cls, **options)
