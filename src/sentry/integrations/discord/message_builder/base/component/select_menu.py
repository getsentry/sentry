from __future__ import annotations

from collections.abc import Iterable
from typing import NotRequired, TypedDict, int

from sentry.integrations.discord.message_builder.base.component.base import (
    DiscordMessageComponent,
    DiscordMessageComponentDict,
)


class DiscordSelectMenuOptionDict(TypedDict):
    label: str
    value: str
    description: NotRequired[str]
    default: NotRequired[bool]


class DiscordSelectMenuDict(DiscordMessageComponentDict):
    custom_id: str
    options: list[DiscordSelectMenuOptionDict]
    placeholder: NotRequired[str]
    min_values: NotRequired[int]
    max_values: NotRequired[int]
    disabled: NotRequired[bool]


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

    def build(self) -> DiscordSelectMenuOptionDict:
        option = DiscordSelectMenuOptionDict(label=self.label, value=self.value)

        if self.description is not None:
            option["description"] = self.description
        if self.default is not None:
            option["default"] = self.default

        return option


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

    def build(self) -> DiscordSelectMenuDict:
        select_menu = DiscordSelectMenuDict(
            type=self.type, custom_id=self.custom_id, options=[o.build() for o in self.options]
        )

        if self.placeholder is not None:
            select_menu["placeholder"] = self.placeholder
        if self.min_values is not None:
            select_menu["min_values"] = self.min_values
        if self.max_values is not None:
            select_menu["max_values"] = self.max_values
        if self.disabled is not None:
            select_menu["disabled"] = self.disabled

        return select_menu
