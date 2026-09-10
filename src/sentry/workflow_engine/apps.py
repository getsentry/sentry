from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.workflow_engine"

    def ready(self) -> None:
        # prevent circular import when trying to use registry
        import sentry.workflow_engine.endpoints.validators.issue_stream_detector  # NOQA

        # Import items that use registries or respond to events
        import sentry.workflow_engine.handlers.condition  # NOQA
        import sentry.workflow_engine.handlers.workflow  # NOQA
        import sentry.workflow_engine.receivers  # NOQA
        from sentry.workflow_engine.endpoints import serializers  # NOQA
