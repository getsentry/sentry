from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.utils.suspect_resolutions_releases"

    def ready(self):
        from .get_suspect_resolutions_releases import get_suspect_resolutions_releases  # NOQA
