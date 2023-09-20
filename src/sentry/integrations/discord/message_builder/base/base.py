from __future__ import annotations

from abc import ABC

from sentry.eventstore.models import Event, GroupEvent
from sentry.integrations.discord.message_builder import DiscordBody
from sentry.integrations.message_builder import AbstractMessageBuilder
from sentry.models import Group

from .component import DiscordMessageComponent
from .embed import DiscordMessageEmbed
from .flags import DiscordMessageFlags


class DiscordMessageBuilder(AbstractMessageBuilder, ABC):
    """
    Base DiscordMessageBuilder class.

    Should be extended to provide more abstracted message builders for
    specific types of messages (e.g. DiscordIssuesMessageBuilder).
    """

    def build(self) -> DiscordBody:
        """Abstract `build` method that all inheritors must implement."""
        raise NotImplementedError

    def build_fallback_text(self, obj: Group | Event | GroupEvent, project_slug: str) -> str:
        """Fallback text is used in the message preview popup."""
        title = obj.title
        if isinstance(obj, GroupEvent) and obj.occurrence is not None:
            title = obj.occurrence.issue_title

        return f"[{project_slug}] {title}"

    @property
    def escape_text(self) -> bool:
        """
        Returns True if we need to escape the text in the message.
        """
        return False

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
