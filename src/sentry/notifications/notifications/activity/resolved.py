from __future__ import annotations

from typing import Any, Mapping

from .base import GroupActivityNotification


class ResolvedActivityNotification(GroupActivityNotification):
    title = "Resolved Issue"
    referrer_base = "resolved-activity"

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        return "{author} marked {an issue} as resolved", {}, {}

    def get_category(self) -> str:
        return "resolved_activity_email"
