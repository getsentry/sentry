from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.notifications"

    def ready(self) -> None:
        # Register the providers and templates for the new platform
        import sentry.notifications.platform.discord.provider  # noqa: F401
        import sentry.notifications.platform.email.provider  # noqa: F401
        import sentry.notifications.platform.msteams.provider  # noqa: F401
        import sentry.notifications.platform.slack.provider  # noqa: F401
        import sentry.notifications.platform.templates  # noqa: F401
