from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.plugins.sentry_webhooks"

    def ready(self):
        from sentry.plugins.base import register

        from .plugin import WebHooksPlugin

        register(WebHooksPlugin)
