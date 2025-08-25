from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.plugins.sentry_useragents"

    def ready(self):
        from sentry.plugins.base import register

        from .models import BrowserPlugin, DevicePlugin, OsPlugin

        register(BrowserPlugin)
        register(OsPlugin)
        register(DevicePlugin)
