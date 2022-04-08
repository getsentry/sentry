from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import StringIndexer

backend = LazyServiceWrapper(
    StringIndexer,
    settings.SENTRY_METRICS_INDEXER,
    settings.SENTRY_METRICS_INDEXER_OPTIONS,
)
backend.expose(locals())

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    record = backend.record
    resolve = backend.resolve
    reverse_resolve = backend.reverse_resolve
