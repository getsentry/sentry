from __future__ import annotations

from .component import DiscordMessageComponent
from .embed import DiscordMessageEmbed
from .flags import DiscordMessageFlags


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

    def build(self, notification_uuid: str | None = None) -> dict[str, object]:
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
    ) -> dict[str, object]:
        """
        Helper method for building arbitrary Discord messages.
        """
        message: dict[str, object] = {}
        message["content"] = content
        message["embeds"] = [] if embeds is None else [embed.build() for embed in embeds]
        message["components"] = (
            [] if components is None else [component.build() for component in components]
        )
        if flags is not None:
            message["flags"] = flags.value
        return message
