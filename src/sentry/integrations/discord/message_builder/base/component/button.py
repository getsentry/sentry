from __future__ import annotations

from typing import NotRequired

from .base import DiscordMessageComponent, DiscordMessageComponentDict


class DiscordButtonDict(DiscordMessageComponentDict):
    style: int
    custom_id: str
    label: NotRequired[str]
    url: NotRequired[str]
    disabled: NotRequired[bool]


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

    def build(self) -> DiscordButtonDict:
        button = DiscordButtonDict(type=self.type, style=self.style, custom_id=self.custom_id)

        if self.label is not None:
            button["label"] = self.label
        if self.url is not None:
            button["url"] = self.url
        if self.disabled is not None:
            button["disabled"] = self.disabled

        return button
