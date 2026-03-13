from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.scm"

    def ready(self) -> None:
        import sentry.scm.stream  # NOQA
        import sentry.scm.private.ipc  # NOQA
