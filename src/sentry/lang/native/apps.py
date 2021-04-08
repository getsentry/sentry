from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.lang.native"

    def ready(self):
        from sentry.plugins.base import register

        from .plugin import NativePlugin

        register(NativePlugin)
