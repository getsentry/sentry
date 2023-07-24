from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import GenericMetricsBackend

backend = LazyServiceWrapper(
    GenericMetricsBackend,
    settings.SENTRY_METRICS_INTERFACE_BACKEND,
    settings.SENTRY_METRICS_INTERFACE_BACKEND_OPTIONS,
)
backend.expose(locals())
