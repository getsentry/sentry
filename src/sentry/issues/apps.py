from django.apps import AppConfig


class Config(AppConfig):  # type: ignore
    name = "sentry.issues"

    def ready(self) -> None:
        from . import analytics, receivers  # NOQA
