from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import BaseTSDB
from .dummy import DummyTSDB

LazyServiceWrapper(
    BaseTSDB, settings.SENTRY_TSDB, settings.SENTRY_TSDB_OPTIONS, dangerous=[DummyTSDB]
).expose(locals())
