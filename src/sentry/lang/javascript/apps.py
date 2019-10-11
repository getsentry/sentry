from __future__ import absolute_import

from django.apps import AppConfig


class LangJavascriptAppConfig(AppConfig):
    name = "sentry.lang.javascript"

    def ready(self):
        from .plugin import JavascriptPlugin
        from sentry.plugins import register

        register(JavascriptPlugin)
