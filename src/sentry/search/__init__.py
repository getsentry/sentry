from __future__ import absolute_import

from django.conf import settings

from sentry.utils.functional import LazyBackendWrapper

from .base import SearchBackend  # NOQA


backend = LazyBackendWrapper(SearchBackend, settings.SENTRY_SEARCH,
                             settings.SENTRY_SEARCH_OPTIONS)
backend.expose(locals())
