from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.processing_errors"

    def ready(self) -> None:
        pass
