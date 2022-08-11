from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.utils.suspect_resolutions"

    def ready(self):
        from . import get_suspect_resolutions  # NOQA
