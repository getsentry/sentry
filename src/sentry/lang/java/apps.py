from __future__ import absolute_import

from django.apps import AppConfig


class LangJavaAppConfig(AppConfig):
    name = "sentry.lang.java"

    def ready(self):
        from .plugin import JavaPlugin
        from sentry.plugins import register

        register(JavaPlugin)
