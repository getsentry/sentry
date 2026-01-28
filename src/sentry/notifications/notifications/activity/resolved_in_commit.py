from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .base import GroupActivityNotification


class ResolvedInCommitActivityNotification(GroupActivityNotification):
    metrics_key = "resolved_in_commit_activity"
    title = "Issue Linked to Commit"

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        return "{author} made a commit that will resolve {an issue}", None, {}
