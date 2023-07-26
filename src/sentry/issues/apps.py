from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.issues"

    def ready(self) -> None:
        from . import analytics, attributes, receivers  # NOQA
