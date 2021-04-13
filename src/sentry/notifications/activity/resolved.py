from typing import Any, Tuple, Union

from .base import ActivityNotification


class ResolvedActivityNotification(ActivityNotification):
    def get_activity_name(self) -> str:
        return "Resolved Issue"

    def get_description(self) -> Union[str, Tuple[str, Any], Tuple[str, Any, Any]]:
        return "{author} marked {an issue} as resolved"

    def get_category(self) -> str:
        return "resolved_activity_email"
