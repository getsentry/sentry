from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import SearchBackend  # NOQA

LazyServiceWrapper(SearchBackend, settings.SENTRY_SEARCH, settings.SENTRY_SEARCH_OPTIONS).expose(
    locals()
)
