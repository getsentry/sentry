from __future__ import absolute_import

from django.conf import settings

from sentry.utils.functional import LazyBackendWrapper

from .base import BaseTSDB  # NOQA
from .dummy import DummyTSDB


backend = LazyBackendWrapper(BaseTSDB, settings.SENTRY_TSDB,
                             settings.SENTRY_TSDB_OPTIONS,
                             (DummyTSDB,))
backend.expose(locals())
