from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.issues"

    def ready(self):
        from . import receivers  # NOQA
