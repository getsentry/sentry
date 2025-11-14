from __future__ import annotations

from collections.abc import Iterable
from typing import int, TypedDict

from .base import DiscordMessageComponent, DiscordMessageComponentDict


class DiscordActionRowDict(TypedDict):
    type: int
    components: list[DiscordMessageComponentDict]  # Components can be buttons, select menus, etc.


class DiscordActionRowError(Exception):
    def __init__(self) -> None:
        super().__init__(
            "A DiscordActionRow cannot be contained within another DiscordActionRow's components"
        )


class DiscordActionRow(DiscordMessageComponent):
    def __init__(self, components: Iterable[DiscordMessageComponent]):
        for component in components:
            if isinstance(component, DiscordActionRow):
                raise DiscordActionRowError()

        self.components = components
        super().__init__(type=1)

    def build(self) -> DiscordActionRowDict:
        # We need to override this build method because we need to call build
        # on subcomponents
        return DiscordActionRowDict(type=self.type, components=[c.build() for c in self.components])
