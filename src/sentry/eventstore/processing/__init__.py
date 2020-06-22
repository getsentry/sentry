from __future__ import absolute_import

from sentry.utils.imports import import_string
from django.conf import settings


event_processing_store = import_string(settings.SENTRY_EVENT_PROCESSING_STORE)(
    **settings.SENTRY_EVENT_PROCESSING_STORE_OPTIONS
)


__all__ = ["event_processing_store"]
