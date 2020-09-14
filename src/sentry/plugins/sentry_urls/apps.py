from __future__ import absolute_import

from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.plugins.sentry_urls"

    def ready(self):
        from .models import UrlsPlugin
        from sentry.plugins.base import register

        register(UrlsPlugin)
