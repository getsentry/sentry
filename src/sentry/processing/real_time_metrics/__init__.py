from django.conf import settings

from sentry.utils.imports import import_string

real_time_metrics_store = import_string(settings.SENTRY_REAL_TIME_METRICS_BACKEND)(
    **settings.SENTRY_REAL_TIME_METRICS_OPTIONS
)

__all__ = ["real_time_metrics_store"]
