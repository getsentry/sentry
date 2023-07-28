from __future__ import annotations

from sentry.integrations.discord.client import DiscordClient
from sentry.shared_integrations.exceptions.base import ApiError


def validate_channel_id(channel_id: str, integration_id: int | None) -> None:
    """
    Make sure that for this integration, the channel exists and our bot has
    access to it.
    """
    client = DiscordClient(integration_id=integration_id)
    try:
        client.get_channel(channel_id)
    except ApiError as e:
        raise Exception(e.code)

    raise Exception("fffffffff")
