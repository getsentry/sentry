"""
Module for the Metrics product built by sentry.
Not to be confused with sentry.metrics, which collects statsd / datadog metrics
"""

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import GenericMetricsBackend

# The charts module provides a service to interface with the external
# Chartcuterie service, which produces charts as images.
#
# This module will handle producing and storing the images given some data that
# you would like to represent as a chart outside of the frontend application.

backend = LazyServiceWrapper(
    GenericMetricsBackend,
    settings.SENTRY_METRICS_INTERFACE_BACKEND,
    settings.SENTRY_METRICS_INTERFACE_BACKEND_OPTIONS,
)
backend.expose(locals())
