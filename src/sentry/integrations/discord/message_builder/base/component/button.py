from __future__ import annotations

from .base import DiscordMessageComponent


class DiscordButtonStyle:
    PRIMARY = 1
    SECONDARY = 2
    SUCCESS = 3
    DANGER = 4
    LINK = 5


class DiscordButton(DiscordMessageComponent):
    # Note that buttons must be contained in an ActionRow!
    def __init__(
        self,
        custom_id: str,
        style: int = DiscordButtonStyle.SECONDARY,
        label: str | None = None,
        url: str | None = None,
        disabled: bool = False,
    ) -> None:
        self.style = style
        self.custom_id = custom_id
        self.label = label
        self.url = url
        self.disabled = disabled
        super().__init__(type=2)
