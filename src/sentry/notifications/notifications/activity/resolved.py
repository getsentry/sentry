from typing import Any, Mapping, Tuple

from .base import GroupActivityNotification


class ResolvedActivityNotification(GroupActivityNotification):
    def get_activity_name(self) -> str:
        return "Resolved Issue"

    def get_description(self) -> Tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        return "{author} marked {an issue} as resolved", {}, {}

    def get_category(self) -> str:
        return "resolved_activity_email"
