from __future__ import absolute_import

from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.plugins.sentry_interface_types"

    def ready(self):
        from .models import InterfaceTypePlugin
        from sentry.plugins.base import register

        register(InterfaceTypePlugin)
