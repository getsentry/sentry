from django.conf import settings

from sentry.utils.imports import import_string

event_processing_store = import_string(settings.SENTRY_EVENT_PROCESSING_STORE)(
    **settings.SENTRY_EVENT_PROCESSING_STORE_OPTIONS
)


__all__ = ["event_processing_store"]
