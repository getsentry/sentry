from django.core.cache import get_cache

from sentry.conf import settings

cache = get_cache(settings.CACHE_BACKEND)
