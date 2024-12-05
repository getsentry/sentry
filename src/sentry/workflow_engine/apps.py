from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.workflow_engine"

    def ready(self):
        # Import our base DataConditionHandlers for the workflow engine platform
        import sentry.workflow_engine.action_handlers  # NOQA
        import sentry.workflow_engine.condition_handlers  # NOQA
        from sentry.workflow_engine.endpoints import serializers  # NOQA
