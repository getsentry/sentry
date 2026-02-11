from django.apps import AppConfig


class SeerConfig(AppConfig):
    name = "sentry.seer"

    def ready(self) -> None:
        # Register all the entrypoints for the operator to use
        import sentry.seer.entrypoints.integrations.slack  # noqa: F401
