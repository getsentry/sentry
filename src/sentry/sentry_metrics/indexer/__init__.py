from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import IndexerApi

backend = LazyServiceWrapper(
    IndexerApi,
    settings.SENTRY_METRICS_INDEXER,
    settings.SENTRY_METRICS_INDEXER_OPTIONS,
)
backend.expose(locals())

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    resolve = IndexerApi().resolve
    reverse_resolve = IndexerApi().reverse_resolve
