from collections.abc import Mapping
from typing import Any

from sentry.notifications.notifications.activity.base import GroupActivityNotification


class UnresolvedActivityNotification(GroupActivityNotification):
    metrics_key = "unresolved_activity"
    title = "Unresolved Issue"

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        return "{author} unresolved {an issue}", None, {}
