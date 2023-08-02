from __future__ import annotations

from collections.abc import Iterable

from sentry.integrations.discord.message_builder.base.component.base import DiscordMessageComponent


class DiscordSelectMenuOption:
    """
    An option for a DiscordSelectMenu.
    """

    def __init__(
        self, label: str, value: str, description: str | None = None, default: bool = False
    ) -> None:
        self.label = label
        self.value = value
        self.description = description
        self.default = default

    def build(self) -> dict[str, object]:
        attributes = vars(self).items()
        return {k: v for k, v in attributes if v is not None}


class DiscordSelectMenu(DiscordMessageComponent):
    """
    A Discord select menu message component. We are only implementing the
    string select variation because the other types are not currently required.

    https://discord.com/developers/docs/interactions/message-components#select-menu-object
    """

    def __init__(
        self,
        custom_id: str,
        options: Iterable[DiscordSelectMenuOption],
        placeholder: str | None = None,
        min_values: int = 1,
        max_values: int = 1,
        disabled: bool = False,
    ) -> None:
        super().__init__(type=3)
        self.custom_id = custom_id
        self.options = options
        self.placeholder = placeholder
        self.min_values = min_values
        self.max_values = max_values
        self.disabled = disabled

    def build(self) -> dict[str, object]:
        select_menu = super().build()
        select_menu["options"] = [o.build() for o in self.options]
        return select_menu
