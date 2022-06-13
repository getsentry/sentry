from __future__ import annotations

from typing import Any, Mapping

from sentry.models import Activity

from .versioned_notification import VersionedGroupActivityNotification


class RegressionActivityNotification(VersionedGroupActivityNotification):
    metrics_key = "regression_activity"
    title = "Regression"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        message, params, html_params = (
            "{author} marked {an issue} as a regression",
            self.get_params(),
            self.get_html_params(),
        )

        if "version" in params:
            message += " in {version}"

        return message, params, html_params
