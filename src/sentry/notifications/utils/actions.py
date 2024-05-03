from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal


@dataclass(kw_only=True)
class BaseMessageAction:
    """
    Base class used to hold the fields for a notification message action
    """

    name: str
    type: Literal["button", "select"] = "button"
    # Label is optional, if empty it falls back to name
    label: str | None = None
    # If the message action is a button type, the url is required
    url: str | None = None
    # If the message action is a select type, this is the selected value
    value: str | None = None
    # Denotes the type of action
    action_id: str | None = None
    block_id: str | None = None
    option_groups: Sequence[Mapping[str, Any]] | None = None
    selected_options: Sequence[Mapping[str, Any]] | None = None


@dataclass
class MessageAction(BaseMessageAction):
    style: Literal["primary", "danger", "default"] | None = None
    elements: Sequence[Mapping[str, Any]] | None = None
