from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.models.activity import Activity

from .base import GroupActivityNotification


class ResolvedInPullRequestActivityNotification(GroupActivityNotification):
    metrics_key = "resolved_in_pull_request_activity"
    title = "Resolved Issue in Pull Request"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.pull_request_url = self.activity.data.get("pull_request", {}).get("externalUrl", "")

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        if self.pull_request_url:
            return (
                "{author} made a <{pull_request_url}| pull request> that will resolve {an issue}",
                None,
                {"pull_request_url": self.pull_request_url},
            )
        return "{author} made a pull request that will resolve {an issue}", None, {}
