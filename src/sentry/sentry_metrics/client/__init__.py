from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import GenericMetricsBackend

generic_metrics_backend = LazyServiceWrapper(
    GenericMetricsBackend,
    settings.SENTRY_METRICS_INTERFACE_BACKEND,
    settings.SENTRY_METRICS_INTERFACE_BACKEND_OPTIONS,
)

__all__ = ["generic_metrics_backend"]
