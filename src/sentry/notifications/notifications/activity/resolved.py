from __future__ import annotations

from typing import Any, Mapping

from .base import GroupActivityNotification


class ResolvedActivityNotification(GroupActivityNotification):
    activity_name = "Resolved Issue"
    category = "resolved_activity_email"

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        return "{author} marked {an issue} as resolved", {}, {}
