from django.conf import settings

from sentry.utils.imports import import_string

realtime_metrics_store = import_string(settings.SENTRY_REALTIME_METRICS_BACKEND)(
    **settings.SENTRY_REALTIME_METRICS_OPTIONS
)

__all__ = ["realtime_metrics_store"]
