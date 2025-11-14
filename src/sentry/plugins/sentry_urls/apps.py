from typing import int
from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.plugins.sentry_urls"

    def ready(self) -> None:
        from sentry.plugins.base import register

        from .models import UrlsPlugin

        register(UrlsPlugin)
