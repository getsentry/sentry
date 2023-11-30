from venv import logger

from django.core.exceptions import ValidationError


def get_channel_id_from_url(channel: str) -> str:
    prefix = "https://discord.com/channels/"

    if not channel:
        logger.info(
            "rule.discord.missing_channel_id",
            extra={
                "reason": "channel ID missing",
            },
        )
        raise ValidationError("Discord channel id is missing")

    if channel.isdigit():
        return channel

    if not channel.startswith(prefix):
        logger.info(
            "rule.discord.bad_channel_url",
            extra={
                "channel_url": channel,
                "reason": "channel URL missing or malformed",
            },
        )
        raise ValidationError("Discord channel URL is missing or formatted incorrectly")

    id_string = channel[len(prefix) :]
    if "/" in id_string:
        channel_id = id_string.split("/")[1]
        if channel_id:
            return channel_id

    logger.info(
        "rule.discord.bad_channel_url.missing_id",
        extra={
            "channel_url": channel,
            "reason": "channel ID missing from URL",
        },
    )
    raise ValidationError("Discord channel id is missing from provided URL")
