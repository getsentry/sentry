from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.models.group import GroupStatus

from .base import GroupActivityNotification


class ResolvedInCommitActivityNotification(GroupActivityNotification):
    metrics_key = "resolved_in_commit_activity"
    title = "Issue Linked to Commit"

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        # Check if the issue is already resolved (API path) or pending resolution (commit push path)
        if self.group.status == GroupStatus.RESOLVED:
            return "{author} marked {an issue} as resolved in a commit", None, {}
        return "{author} made a commit that will resolve {an issue}", None, {}
