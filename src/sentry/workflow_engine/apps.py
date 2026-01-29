from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.workflow_engine"

    def ready(self) -> None:
        # Import our base DataConditionHandlers for the workflow engine platform
        import sentry.workflow_engine.handlers  # NOQA -- Register handlers
        from sentry.workflow_engine.endpoints import serializers  # NOQA -- Register the serializers
        from sentry.workflow_engine.models import signals  # NOQA -- Register the Signals
