from __future__ import annotations

from django.core.exceptions import ValidationError

from sentry.integrations.discord.client import DiscordClient
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.shared_integrations.exceptions.base import ApiError

from . import logger

NO_CHANNEL_MESSAGE = "We couldn't find a channel with that ID. Make sure you have the correct server selected and are providing a Discord channel ID (not a channel name)."


def validate_channel_id(channel_id: str, guild_id: str, integration_id: int | None) -> None:
    """
    Make sure that for this integration, the channel exists, belongs to this
    integration, and our bot has access to it.
    """
    client = DiscordClient(integration_id=integration_id)
    try:
        result = client.get_channel(channel_id)
    except ApiError as e:
        if e.code == 400:
            logger.info(
                "rule.discord.channel_info_failed",
                extra={
                    "channel_id": channel_id,
                    "reason": "channel ID missing or malformed",
                    "code": e.code,
                },
            )
            raise ValidationError("Discord channel id is missing or not formatted correctly")
        elif e.code == 403:
            logger.info(
                "rule.discord.channel_info_failed",
                extra={
                    "channel_id": channel_id,
                    "reason": "channel access not allowed",
                    "code": e.code,
                },
            )
            raise ValidationError("Discord channel exists but access is not allowed")
        elif e.code == 404:
            logger.info(
                "rule.discord.channel_info_failed",
                extra={
                    "channel_id": channel_id,
                    "reason": "channel not found",
                    "code": e.code,
                },
            )
            raise ValidationError("Discord channel can not be found.")
        else:
            logger.info(
                "rule.discord.channel_integration_failed",
                extra={
                    "guild_id": guild_id,
                    "channel_id": channel_id,
                    "reason": "channel does not belong to indicated guild (server)",
                    "code": e.code,
                },
            )
            raise IntegrationError("Discord channel does not belong to the server indicated.")

    if not isinstance(result, dict):
        raise IntegrationError("Bad response from Discord channel lookup.")

    if result["guild_id"] != guild_id:
        # The channel exists and we have access to it, but it does not belong
        # to the specified guild! We'll use the same message as generic 404,
        # so we don't expose other guilds' channel IDs.
        logger.info(
            "rule.discord.wrong_guild_for_channel",
            extra={"guild_id": guild_id, "channel_belongs_to": result["guild_id"]},
        )
        raise ValidationError(NO_CHANNEL_MESSAGE)
