from django.apps import AppConfig


class Config(AppConfig):  # type: ignore
    name = "sentry.utils.suspect_resolutions"

    def ready(self) -> None:
        from .get_suspect_resolutions import get_suspect_resolutions  # NOQA
