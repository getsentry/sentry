from enum import StrEnum

SLACK_RATE_LIMITED_MESSAGE = "Requests to Slack exceeded the rate limit. Please try again later."


class SlackScope(StrEnum):
    """OAuth scopes for the Slack integration."""

    REACTIONS_WRITE = "reactions:write"
    """Allows the bot to add and remove reactions to messages."""
    CHANNELS_HISTORY = "channels:history"
    """Allows the bot to read message history in channels."""
    GROUPS_HISTORY = "groups:history"
    """Allows the bot to read message history in private groups."""
    APP_MENTIONS_READ = "app_mentions:read"
    """Allows the bot to read mentions in app messages."""
