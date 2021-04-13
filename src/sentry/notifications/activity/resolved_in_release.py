from typing import Any, Tuple, Union

from sentry.utils.html import escape
from sentry.utils.http import absolute_uri

from .base import ActivityNotification


class ResolvedInReleaseActivityNotification(ActivityNotification):
    def get_activity_name(self) -> str:
        return "Resolved Issue"

    def get_description(self) -> Union[str, Tuple[str, Any], Tuple[str, Any, Any]]:
        data = self.activity.data

        url = "/organizations/{}/releases/{}/?project={}".format(
            self.organization.slug, data["version"], self.project.id
        )

        if data.get("version"):
            return (
                "{author} marked {an issue} as resolved in {version}",
                {"version": data["version"]},
                {
                    "version": '<a href="{}">{}</a>'.format(
                        absolute_uri(url), escape(data["version"])
                    )
                },
            )
        return "{author} marked {an issue} as resolved in an upcoming release"

    def get_category(self) -> str:
        return "resolved_in_release_activity_email"
