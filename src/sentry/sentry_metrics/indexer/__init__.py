from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import StringIndexer

backend = LazyServiceWrapper(
    StringIndexer,
    settings.SENTRY_METRICS_INDEXER,
    settings.SENTRY_METRICS_INDEXER_OPTIONS,
)
backend.expose(locals())
