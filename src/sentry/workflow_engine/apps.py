from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.workflow_engine"

    def ready(self):
        import sentry.workflow_engine.models.workflow  # noqa
