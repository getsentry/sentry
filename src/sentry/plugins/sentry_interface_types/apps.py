from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.plugins.sentry_interface_types"

    def ready(self):
        from sentry.plugins.base import register

        from .models import InterfaceTypePlugin

        register(InterfaceTypePlugin)
