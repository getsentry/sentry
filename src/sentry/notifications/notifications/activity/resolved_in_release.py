from __future__ import annotations

from typing import Any, Mapping

from sentry.models import Activity

from .versioned_notification import VersionedGroupActivityNotification


class ResolvedInReleaseActivityNotification(VersionedGroupActivityNotification):
    metrics_key = "resolved_in_release_activity"
    title = "Resolved Issue"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        message, params, html_params = (
            "{author} marked {an issue} as resolved in {version}",
            self.get_params(),
            self.get_html_params(),
        )

        params["version"] = params.get("version", "an upcoming release")

        return message, params, html_params
