from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.lang.java"

    def ready(self):
        from sentry.plugins.base import register

        from .plugin import JavaPlugin

        register(JavaPlugin)
