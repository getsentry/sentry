from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.notifications"

    def ready(self) -> None:
        # Imports to populate registries
        import sentry.notifications.platform.discord.provider  # noqa: F401
        import sentry.notifications.platform.discord.renderers.issue  # noqa: F401
        import sentry.notifications.platform.discord.renderers.metric_alert  # noqa: F401
        import sentry.notifications.platform.email.provider  # noqa: F401
        import sentry.notifications.platform.msteams.provider  # noqa: F401
        import sentry.notifications.platform.msteams.renderers.issue  # noqa: F401
        import sentry.notifications.platform.slack.provider  # noqa: F401
        import sentry.notifications.platform.slack.renderers.issue  # noqa: F401
        import sentry.notifications.platform.slack.renderers.metric_alert  # noqa: F401
        import sentry.notifications.platform.slack.renderers.seer  # noqa: F401
        import sentry.notifications.platform.slack.renderers.seer_agent_write_approval  # noqa: F401
        import sentry.notifications.platform.templates  # noqa: F401
