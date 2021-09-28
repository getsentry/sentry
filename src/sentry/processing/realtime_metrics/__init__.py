from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import RealtimeMetricsStore

realtime_metrics_store = LazyServiceWrapper(
    RealtimeMetricsStore,
    settings.SENTRY_REALTIME_METRICS_BACKEND,
    settings.SENTRY_REALTIME_METRICS_OPTIONS,
)

realtime_metrics_store.expose(locals())
