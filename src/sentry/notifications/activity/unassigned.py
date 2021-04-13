from typing import Any, Tuple, Union

from .base import ActivityNotification


class UnassignedActivityNotification(ActivityNotification):
    def get_activity_name(self) -> str:
        return "Unassigned"

    def get_description(self) -> Union[str, Tuple[str, Any], Tuple[str, Any, Any]]:
        return "{author} unassigned {an issue}"

    def get_category(self) -> str:
        return "unassigned_activity_email"
