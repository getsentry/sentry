from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.notifications.platform"

    def ready(self) -> None:
        # Register the providers providers
        from .discord.provider import DiscordNotificationProvider  # NOQA
        from .email.provider import EmailNotificationProvider  # NOQA
        from .msteams.provider import MSTeamsNotificationProvider  # NOQA
        from .slack.provider import SlackNotificationProvider  # NOQA
