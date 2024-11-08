from django.conf import settings

from sentry.eventstore.reprocessing.base import ReprocessingStore
from sentry.utils.services import LazyServiceWrapper

reprocessing_store = LazyServiceWrapper(
    ReprocessingStore,
    settings.SENTRY_REPROCESSING_STORE,
    settings.SENTRY_REPROCESSING_STORE_OPTIONS,
)


__all__ = ["reprocessing_store"]
