from enum import StrEnum

SLACK_RATE_LIMITED_MESSAGE = "Requests to Slack exceeded the rate limit. Please try again later."


class SlackScope(StrEnum):
    """OAuth scopes for the Slack integration."""

    REACTIONS_WRITE = "reactions:write"
    CHANNELS_HISTORY = "channels:history"
    GROUPS_HISTORY = "groups:history"
    APP_MENTIONS_READ = "app_mentions:read"
