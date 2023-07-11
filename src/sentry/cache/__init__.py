__all__ = ["default_cache"]

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from sentry.cache.base import BaseCache
from sentry.utils.imports import import_string

if not settings.SENTRY_CACHE:
    raise ImproperlyConfigured("You must configure ``cache.backend``.")

default_cache: BaseCache = import_string(settings.SENTRY_CACHE)(**settings.SENTRY_CACHE_OPTIONS)
