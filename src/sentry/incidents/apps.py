from __future__ import absolute_import

from django.apps import AppConfig


class IncidentsAppConfig(AppConfig):
    name = "sentry.incidents"

    def ready(self):
        from . import receivers  # noqa
