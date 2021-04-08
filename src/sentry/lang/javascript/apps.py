from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.lang.javascript"

    def ready(self):
        from sentry.plugins.base import register

        from .plugin import JavascriptPlugin

        register(JavascriptPlugin)
