from __future__ import absolute_import

from django.apps import AppConfig


class LangNativeAppConfig(AppConfig):
    name = "sentry.lang.native"

    def ready(self):
        from .plugin import NativePlugin
        from sentry.plugins import register

        register(NativePlugin)
