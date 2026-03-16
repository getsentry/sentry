from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.issue_detection"

    def ready(self) -> None:
        pass
