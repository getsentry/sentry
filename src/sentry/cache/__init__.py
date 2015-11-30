from __future__ import absolute_import

__all__ = ['default_cache']

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from sentry.utils.imports import import_string

if not settings.SENTRY_CACHE:
    raise ImproperlyConfigured('You must configure ``cache.backend``.')

default_cache = import_string(settings.SENTRY_CACHE)(
    **settings.SENTRY_CACHE_OPTIONS
)
