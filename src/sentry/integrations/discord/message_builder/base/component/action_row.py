from __future__ import annotations

from collections.abc import Iterable

from .base import DiscordMessageComponent


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

    def build(self) -> dict[str, object]:
        # We need to override this build method because we need to call build
        # on subcomponents
        return {"type": self.type, "components": [c.build() for c in self.components]}
