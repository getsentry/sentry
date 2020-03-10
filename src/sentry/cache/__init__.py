from __future__ import absolute_import

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from sentry.utils.imports import import_string

__all__ = ["default_cache"]



if not settings.SENTRY_CACHE:
    raise ImproperlyConfigured("You must configure ``cache.backend``.")

default_cache = import_string(settings.SENTRY_CACHE)(**settings.SENTRY_CACHE_OPTIONS)
