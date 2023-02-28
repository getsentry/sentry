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
    bulk_record = StringIndexer().bulk_record
    record = StringIndexer().record
    resolve = StringIndexer().resolve
    reverse_resolve = StringIndexer().reverse_resolve
    resolve_shared_org = StringIndexer().resolve_shared_org
