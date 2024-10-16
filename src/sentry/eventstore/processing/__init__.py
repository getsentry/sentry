from django.conf import settings

from sentry.eventstore.processing.base import EventProcessingStore
from sentry.utils.services import LazyServiceWrapper

event_processing_store = LazyServiceWrapper(
    EventProcessingStore,
    settings.SENTRY_EVENT_PROCESSING_STORE,
    settings.SENTRY_EVENT_PROCESSING_STORE_OPTIONS,
)

transaction_processing_store = LazyServiceWrapper(
    EventProcessingStore,
    settings.SENTRY_TRANSACTIONS_PROCESSING_STORE,
    settings.SENTRY_TRANSACTIONS_PROCESSING_STORE_OPTIONS,
)


__all__ = ["event_processing_store", "transaction_processing_store"]
