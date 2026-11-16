from django.apps import AppConfig


class CadenceConfig(AppConfig):
    name = "sentry.cadence"

    def ready(self) -> None:
        # Register cadence's own trigger types.
        import sentry.cadence.actions  # noqa: F401
