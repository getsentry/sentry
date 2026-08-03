from enum import StrEnum


class SlackScope(StrEnum):
    """
    OAuth scopes for the Slack integration.

    Keep this outside ``sentry.integrations.slack`` so import-sensitive code
    (like API serializers during app startup) can reference Slack protocol
    constants without executing the heavy Slack package ``__init__`` and
    triggering circular imports.
    """

    CHANNELS_HISTORY = "channels:history"
    """Allows the bot to read message history in channels."""
    GROUPS_HISTORY = "groups:history"
    """Allows the bot to read message history in private groups."""
    APP_MENTIONS_READ = "app_mentions:read"
    """Allows the bot to read mentions in app messages."""
    ASSISTANT_WRITE = "assistant:write"
    """Allows the bot to act as a Slack Agent."""
