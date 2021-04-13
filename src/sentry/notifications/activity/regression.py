from typing import Any, Mapping, Tuple

from sentry.utils.html import escape
from sentry.utils.http import absolute_uri

from .base import ActivityNotification


class RegressionActivityNotification(ActivityNotification):
    def get_activity_name(self) -> str:
        return "Regression"

    def get_description(self) -> Tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        data = self.activity.data

        if data.get("version"):
            version_url = "/organizations/{}/releases/{}/".format(
                self.organization.slug, data["version"]
            )

            return (
                "{author} marked {an issue} as a regression in {version}",
                {"version": data["version"]},
                {
                    "version": '<a href="{}">{}</a>'.format(
                        absolute_uri(version_url), escape(data["version"])
                    )
                },
            )

        return "{author} marked {an issue} as a regression", {}, {}

    def get_category(self) -> str:
        return "regression_activity_email"
