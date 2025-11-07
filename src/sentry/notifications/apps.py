from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.notifications"

    def ready(self) -> None:
        # Register the NotificationProviders for the legacy platform
        import sentry.integrations.msteams.notifications  # noqa: F401
        import sentry.integrations.slack.notifications  # noqa: F401
        import sentry.mail.notifications  # noqa: F401

        # Register the providers and templates for the new platform
        import sentry.notifications.platform.discord.provider  # noqa: F401
        import sentry.notifications.platform.email.provider  # noqa: F401
        import sentry.notifications.platform.msteams.provider  # noqa: F401
        import sentry.notifications.platform.slack.provider  # noqa: F401
        import sentry.notifications.platform.templates  # noqa: F401
