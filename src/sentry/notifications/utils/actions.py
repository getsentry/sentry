from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal

from sentry.integrations.slack import SlackBlock


@dataclass(kw_only=True)
class _BaseMessageAction:
    """
    Base class used to hold the fields for a notification message action
    """

    name: str
    type: Literal["button", "select"] = "button"
    # If the message action is a button type, the url is required
    url: str | None = None
    # If the message action is a select type, this is the selected value
    value: str | None = None
    # Denotes the type of action
    action_id: str | None = None
    block_id: str | None = None
    selected_options: Sequence[Mapping[str, Any]] | None = None

    def _get_button_text(self) -> str:
        return self.name

    def get_button(self) -> SlackBlock:
        button = {
            "type": "button",
            "text": {"type": "plain_text", "text": self._get_button_text()},
        }
        if self.value:
            button["action_id"] = self.value
            button["value"] = self.value

        if self.action_id:
            button["action_id"] = self.action_id

        if self.url:
            button["url"] = self.url
            button["value"] = "link_clicked"

        return button


@dataclass
class MessageAction(_BaseMessageAction):
    # Label is optional, if empty it falls back to name
    label: str | None = None
    style: Literal["primary", "danger", "default"] | None = None
    option_groups: Sequence[Mapping[str, Any]] | None = None
    elements: Sequence[Mapping[str, Any]] | None = None

    def _get_button_text(self) -> str:
        return self.label or self.name


@dataclass
class BlockKitMessageAction(_BaseMessageAction):
    label: str

    def _get_button_text(self) -> str:
        return self.label or self.name
