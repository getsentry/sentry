from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.notifications"

    def ready(self):
        # Register the NotificationProviders for the platform
        from .platform.discord.provider import DiscordNotificationProvider  # NOQA
        from .platform.email.provider import EmailNotificationProvider  # NOQA
        from .platform.msteams.provider import MSTeamsNotificationProvider  # NOQA
        from .platform.slack.provider import SlackNotificationProvider  # NOQA
