from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .base import ChartRenderer  # NOQA

# The charts module provides a service to interface with the external
# Chartcuterie service, which produces charts as images.
#
# This module will handle producing and storing the images given some data that
# you would like to represent as a chart outside of the frontend application.

backend = LazyServiceWrapper(
    ChartRenderer,
    settings.SENTRY_CHART_RENDERER,
    settings.SENTRY_CHART_RENDERER_OPTIONS,
)
backend.expose(locals())
