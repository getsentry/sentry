from collections.abc import Mapping
from typing import Any

from sentry.notifications.notifications.activity.assigned import (
    AssignedActivityNotification as BaseAssignedActivityNotification,
)


class AssignedActivityNotification(BaseAssignedActivityNotification):
    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        return "{author} assigned this issue to {assignee}", None, {"assignee": self.get_assignee()}
