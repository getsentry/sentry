from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.notifications"

    def ready(self):
        # Register the NotificationProviders for the platform
        from sentry.notifications.platform.discord.provider import (  # NOQA
            DiscordNotificationProvider,
        )
        from sentry.notifications.platform.email.provider import EmailNotificationProvider  # NOQA
        from sentry.notifications.platform.msteams.provider import (  # NOQA
            MSTeamsNotificationProvider,
        )
        from sentry.notifications.platform.slack.provider import SlackNotificationProvider  # NOQA
