from django.apps import AppConfig


class InvestigationsConfig(AppConfig):
    name = "sentry.investigations"

    def ready(self) -> None:
        # Registers the workflow engine action handler.
        import sentry.investigations.alert_action  # noqa: F401
