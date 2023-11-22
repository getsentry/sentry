from typing import Optional
from venv import logger

from django.core.exceptions import ValidationError


def get_channel_id_from_url(channel_url: str) -> Optional[str]:
    # https://discord.com/channels/1146873646112059423/1157018214425956502
    prefix = "https://discord.com/channels/"

    if not channel_url.startswith(prefix):
        logger.info(
            "rule.discord.bad_channel_url",
            extra={
                "channel_url": channel_url,
                "reason": "channel URL missing or malformed",
            },
        )
        raise ValidationError("Discord channel URL is missing or formatted incorrectly")

    id_string = channel_url[len(prefix) :]
    if "/" in id_string:
        channel_id = id_string.split("/")[1]
        if channel_id:
            return channel_id

    logger.info(
        "rule.discord.bad_channel_url.missing_id",
        extra={
            "channel_url": channel_url,
            "reason": "channel ID missing from URL",
        },
    )
    raise ValidationError("Discord channel id is missing from provided URL")
