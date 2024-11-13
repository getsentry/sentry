from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.workflow_engine"

    def ready(self):
        from sentry.workflow_engine.endpoints import serializers  # NOQA
