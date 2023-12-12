from __future__ import annotations

from enum import Enum

from django.core.exceptions import ValidationError
from requests.exceptions import Timeout

from sentry.integrations.discord.client import DiscordClient
from sentry.shared_integrations.exceptions import ApiError, ApiTimeoutError, IntegrationError

from . import logger


class ChannelType(Enum):
    # https://discord.com/developers/docs/resources/channel#channel-object-channel-types
    GUILD_TEXT = 0
    DM = 1
    GUILD_VOICE = 2
    GROUP_DM = 3
    GUILD_CATEGORY = 4
    GUILD_ANNOUNCEMENT = 5
    ANNOUNCEMENT_THREAD = 10
    PUBLIC_THREAD = 11
    PRIVATE_THREAD = 12
    GUILD_STAGE_VOICE = 13
    GUILD_DIRECTORY = 14
    GUILD_FORUM = 15
    GUILD_MEDIA = 16


SUPPORTED_CHANNEL_TYPES = {
    ChannelType.GUILD_TEXT,
    ChannelType.PUBLIC_THREAD,
    ChannelType.PRIVATE_THREAD,
}


def validate_channel_id(channel_id: str, guild_id: str, guild_name: str | None) -> None:
    """
    Make sure that for this integration, the channel exists, belongs to this
    integration, and our bot has access to it.
    """
    client = DiscordClient()
    try:
        result = client.get_channel(channel_id)
    except ApiError as e:
        if e.code == 400:
            logger.info(
                "rule.discord.channel_info_failed",
                extra={
                    "channel_id": channel_id,
                    "guild_name": guild_name,
                    "reason": "channel ID missing or malformed",
                    "code": e.code,
                },
            )
            raise ValidationError("Discord channel id is missing or formatted incorrectly")
        elif e.code == 403:
            logger.info(
                "rule.discord.channel_info_failed",
                extra={
                    "channel_id": channel_id,
                    "guild_name": guild_name,
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
                    "guild_name": guild_name,
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
                    "guild_name": guild_name,
                    "code": e.code,
                },
            )
            raise IntegrationError("Bad response from Discord channel lookup.")
    except Timeout:
        logger.info(
            "rule.discord.channel_lookup_timed_out",
            extra={
                "channel_id": channel_id,
                "guild_name": guild_name,
                "reason": "channel lookup timed out",
            },
        )
        raise ApiTimeoutError("Discord channel lookup timed out")

    if not isinstance(result, dict):
        raise IntegrationError("Bad response from Discord channel lookup.")

    if ChannelType(result["type"]) not in SUPPORTED_CHANNEL_TYPES:
        # Forums are not supported
        logger.info(
            "rule.discord.wrong_channel_type",
            extra={
                "channel_id": channel_id,
                "guild_name": guild_name,
                "channel_type": result["type"],
            },
        )
        raise ValidationError("Discord channel type is not supported")

    if result["guild_id"] != guild_id:
        # The channel exists and we have access to it, but it does not belong
        # to the specified guild! We'll use the same message as generic 404,
        # so we don't expose other guilds' channel IDs.
        logger.info(
            "rule.discord.wrong_guild_for_channel",
            extra={
                "guild_id": guild_id,
                "channel_belongs_to": result["guild_id"],
                "guild_name": guild_name,
            },
        )
        raise ValidationError(f"Discord channel not in {guild_name}")
