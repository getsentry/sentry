__all__ = ["default_cache"]

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from sentry.utils.imports import import_string

if not settings.SENTRY_CACHE:
    raise ImproperlyConfigured("You must configure ``cache.backend``.")

default_cache = import_string(settings.SENTRY_CACHE)(
    is_default_cache=True, **settings.SENTRY_CACHE_OPTIONS
)
