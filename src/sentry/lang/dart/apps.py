from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.lang.dart"

    def ready(self):
        from sentry.plugins.base import register

        from .plugin import DartPlugin

        register(DartPlugin)
