from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.inbox"

    def ready(self) -> None:
        import sentry.inbox.issue  # noqa: F401
