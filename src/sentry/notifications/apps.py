from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.notifications"

    def ready(self) -> None:
        # Imports to populate registries
        import sentry.notifications.notification_action.activity_registry  # noqa: F401
        import sentry.notifications.platform.discord.provider  # noqa: F401
        import sentry.notifications.platform.email.provider  # noqa: F401
        import sentry.notifications.platform.msteams.provider  # noqa: F401
        import sentry.notifications.platform.slack.provider  # noqa: F401
        import sentry.notifications.platform.templates  # noqa: F401
