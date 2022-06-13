from __future__ import annotations

from typing import Any, Mapping

from .base import GroupActivityNotification


class UnassignedActivityNotification(GroupActivityNotification):
    metrics_key = "unassigned_activity"
    title = "Unassigned"

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        return "{author} unassigned {an issue}", {}, {}
