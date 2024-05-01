from collections.abc import Mapping
from typing import Any

from sentry.notifications.notifications.activity.assigned import (
    AssignedActivityNotification as BaseAssignedActivityNotification,
)


class AssignedActivityNotification(BaseAssignedActivityNotification):
    """
    This notification overrides the base AssignedActivityNotification text template to remove the explicit issue name,
    and instead leverages "this issue" since this notification is already attached to an existing notification where
    the issue name exists.
    """

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        return "{author} assigned this issue to {assignee}", None, {"assignee": self.get_assignee()}
