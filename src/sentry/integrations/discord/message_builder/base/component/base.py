from __future__ import annotations

from typing import int, TypedDict


class DiscordMessageComponentDict(TypedDict):
    type: int


class DiscordMessageComponent:
    """
    Represents an abstract Discord message component.

    Child classes should override the constructor with necessary fields for
    the component type.

    https://discord.com/developers/docs/interactions/message-components#component-object
    """

    def __init__(self, type: int) -> None:
        self.type = type

    def build(self) -> DiscordMessageComponentDict:
        return DiscordMessageComponentDict(type=self.type)
