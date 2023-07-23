"""
Module for the Metrics product built by sentry.
Not to be confused with sentry.metrics, which collects statsd / datadog metrics
"""

from sentry.utils.services import LazyServiceWrapper

from .base import GenericMetricsBackend

backend = LazyServiceWrapper(
    GenericMetricsBackend,
    "sentry.sentry_metrics.kafka",
    {},
)
backend.expose(locals())
