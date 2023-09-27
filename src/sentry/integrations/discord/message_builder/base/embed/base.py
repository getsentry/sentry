from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime

from sentry.integrations.discord.message_builder.base.embed.field import DiscordMessageEmbedField
from sentry.integrations.discord.message_builder.base.embed.footer import DiscordMessageEmbedFooter
from sentry.integrations.discord.message_builder.base.embed.image import DiscordMessageEmbedImage


class DiscordMessageEmbed:
    """
    Represents a rich embed object.

    Some fields are not implemented, add to this as needed.

    https://discord.com/developers/docs/resources/channel#embed-object
    """

    def __init__(
        self,
        title: str | None = None,
        description: str | None = None,
        url: str | None = None,
        color: int | None = None,
        footer: DiscordMessageEmbedFooter | None = None,
        fields: Iterable[DiscordMessageEmbedField] | None = None,
        timestamp: datetime | None = None,
        image: DiscordMessageEmbedImage | None = None,
    ) -> None:
        self.title = title
        self.description = description
        self.url = url
        self.color = color
        self.footer = footer
        self.fields = fields
        self.timestamp = timestamp
        self.image = image

    def build(self) -> dict[str, object]:
        attributes = vars(self).items()
        embed = {k: v for k, v in attributes if v is not None}

        if self.footer is not None:
            embed["footer"] = self.footer.build()

        if self.fields is not None:
            embed["fields"] = [field.build() for field in self.fields]

        if self.timestamp is not None:
            embed["timestamp"] = self.timestamp.isoformat()

        if self.image is not None:
            embed["image"] = self.image.build()

        return embed
