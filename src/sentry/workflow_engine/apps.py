from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.workflow_engine"

    def ready(self) -> None:
        # Import items that use registries or respond to events
        import sentry.workflow_engine.handlers.condition  # NOQA
        import sentry.workflow_engine.handlers.workflow  # NOQA
        import sentry.workflow_engine.receivers  # NOQA
        from sentry.workflow_engine.endpoints import serializers  # NOQA
