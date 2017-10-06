from __future__ import absolute_import

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import SearchBackend  # NOQA

backend = LazyServiceWrapper(SearchBackend, settings.SENTRY_SEARCH, settings.SENTRY_SEARCH_OPTIONS)
backend.expose(locals())
