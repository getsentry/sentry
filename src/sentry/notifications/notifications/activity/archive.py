from collections.abc import Mapping
from typing import Any

from sentry.notifications.notifications.activity.base import GroupActivityNotification


class ArchiveActivityNotification(GroupActivityNotification):
    metrics_key = "archived_activity"
    title = "Archived Issue"

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        return "{author} archived {an issue}", None, {}
