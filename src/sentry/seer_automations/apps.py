from django.apps import AppConfig


class SeerAutomationsConfig(AppConfig):
    name = "sentry.seer_automations"

    def ready(self) -> None:
        import sentry.seer_automations.workflows.action  # noqa: F401
