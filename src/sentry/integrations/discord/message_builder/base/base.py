from __future__ import annotations

from typing import NotRequired, TypedDict, int

from sentry.integrations.discord.message_builder.base.component.base import (
    DiscordMessageComponent,
    DiscordMessageComponentDict,
)
from sentry.integrations.discord.message_builder.base.embed.base import (
    DiscordMessageEmbed,
    DiscordMessageEmbedDict,
)
from sentry.integrations.discord.message_builder.base.flags import DiscordMessageFlags


class DiscordMessage(TypedDict):
    content: str
    components: NotRequired[list[DiscordMessageComponentDict]]
    embeds: NotRequired[list[DiscordMessageEmbedDict]]
    flags: NotRequired[int]


class DiscordMessageBuilder:
    """
    Base DiscordMessageBuilder class.

    Should be extended to provide more abstracted message builders for
    specific types of messages (e.g. DiscordIssuesMessageBuilder).
    """

    def __init__(
        self,
        content: str = "",
        embeds: list[DiscordMessageEmbed] | None = None,
        components: list[DiscordMessageComponent] | None = None,
        flags: DiscordMessageFlags | None = None,
    ) -> None:
        self.content = content
        self.embeds = embeds
        self.components = components
        self.flags = flags

    def build(self, notification_uuid: str | None = None) -> DiscordMessage:
        return self._build(
            self.content,
            self.embeds,
            self.components,
            self.flags,
        )

    def _build(
        self,
        content: str = "",
        embeds: list[DiscordMessageEmbed] | None = None,
        components: list[DiscordMessageComponent] | None = None,
        flags: DiscordMessageFlags | None = None,
    ) -> DiscordMessage:
        """
        Helper method for building arbitrary Discord messages.
        """
        embeds_list = [] if embeds is None else [embed.build() for embed in embeds]
        components_list = (
            [] if components is None else [component.build() for component in components]
        )

        message = DiscordMessage(content=content, embeds=embeds_list, components=components_list)

        if flags is not None:
            message["flags"] = flags.value

        return message
