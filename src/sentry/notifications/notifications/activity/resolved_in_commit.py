from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .base import GroupActivityNotification


class ResolvedInCommitActivityNotification(GroupActivityNotification):
    metrics_key = "resolved_in_commit_activity"
    title = "Resolved Issue in Commit"

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        return "{author} marked {an issue} as resolved in a commit", None, {}
