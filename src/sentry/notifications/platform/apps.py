from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.notifications.platform"

    def ready(self):
        # Register the notification providers
        import sentry.notifications.platform.providers  # NOQA
