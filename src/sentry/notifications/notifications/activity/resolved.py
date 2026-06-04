from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .base import GroupActivityNotification


class ResolvedActivityNotification(GroupActivityNotification):
    metrics_key = "resolved_activity"
    title = "Resolved Issue"

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        return "{author} marked {an issue} as resolved", None, {}
