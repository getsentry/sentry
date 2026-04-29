from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .base import GroupActivityNotification


class ReferencedInCommitActivityNotification(GroupActivityNotification):
    metrics_key = "referenced_in_commit_activity"
    title = "Issue Referenced in Commit"

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        return "{author} referenced {an issue} in a commit", None, {}
