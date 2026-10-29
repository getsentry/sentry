from django.apps import AppConfig


class CadenceConfig(AppConfig):
    name = "sentry.cadence"

    def ready(self) -> None:
        # Registers the trigger actions.
        from sentry.cadence import actions  # noqa: F401
