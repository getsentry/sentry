from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.workflow_engine"

    def ready(self):
        # Import our base DataConditionHandlers for the workflow engine platform
        import sentry.workflow_engine.handlers  # NOQA
        from sentry.workflow_engine.endpoints import serializers  # NOQA
