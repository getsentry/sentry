from __future__ import annotations

from typing import Any, Mapping

from sentry_relay import parse_release

from sentry.models import Activity
from sentry.utils.html import escape
from sentry.utils.http import absolute_uri

from .base import GroupActivityNotification


class RegressionActivityNotification(GroupActivityNotification):
    referrer_base = "regression-activity"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.version = self.activity.data.get("version", "")
        self.version_parsed = parse_release(self.version)["description"]

    def get_activity_name(self) -> str:
        return "Regression"

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        message, params, html_params = "{author} marked {an issue} as a regression", {}, {}

        if self.version:
            version_url = absolute_uri(
                f"/organizations/{self.organization.slug}/releases/{self.version_parsed}/"
            )

            message += " in {version}"
            params["version"] = self.version_parsed
            html_params["version"] = f'<a href="{version_url}">{escape(self.version_parsed)}</a>'

        return message, params, html_params

    def get_category(self) -> str:
        return "regression_activity_email"

    def get_notification_title(self) -> str:
        text = "Issue marked as regression"
        if self.version:
            text += f" in release {self.version_parsed}"
        return text
