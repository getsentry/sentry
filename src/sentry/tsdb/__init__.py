from __future__ import absolute_import

from django.conf import settings

from sentry.utils.functional import LazyBackendWrapper

from .base import BaseTSDB  # NOQA


backend = LazyBackendWrapper(BaseTSDB, settings.SENTRY_TSDB,
                             settings.SENTRY_TSDB_OPTIONS)
backend.expose(locals())
