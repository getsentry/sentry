from __future__ import annotations

from typing import Any, Mapping

from .base import GroupActivityNotification


class ResolvedActivityNotification(GroupActivityNotification):
    metrics_key = "resolved_activity"
    title = "Resolved Issue"

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        return "{author} marked {an issue} as resolved", {}, {}
