from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from typing_extensions import Literal

from sentry.utils.types import Any, Sequence


@dataclass
class MessageAction:
    name: str

    # Optional label. This falls back to name.
    label: str | None = None

    type: Literal["button", "select"] = "button"

    # If this is a button type, a url is required.
    url: str | None = None

    # If this is a select type, the selected value.
    value: str | None = None

    # Denotes the type of action
    action_id: str | None = None

    style: Literal["primary", "danger", "default"] | None = None

    # TODO(mgaeta): Refactor this to be provider-agnostic
    selected_options: Sequence[Mapping[str, Any]] | None = None
    option_groups: Sequence[Mapping[str, Any]] | None = None
    block_id: str | None = None
    elements: Sequence[Mapping[str, Any]] | None = None
