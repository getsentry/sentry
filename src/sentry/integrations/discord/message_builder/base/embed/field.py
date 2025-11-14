from __future__ import annotations

from typing import int, TypedDict


class DiscordMessageEmbedFieldDict(TypedDict):
    name: str
    value: str
    inline: bool


class DiscordMessageEmbedField:
    def __init__(self, name: str, value: str, inline: bool = False) -> None:
        self.name = name
        self.value = value
        self.inline = inline

    def build(self) -> DiscordMessageEmbedFieldDict:
        embed_field = DiscordMessageEmbedFieldDict(
            name=self.name, value=self.value, inline=self.inline
        )
        return embed_field
