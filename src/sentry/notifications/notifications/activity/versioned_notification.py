import abc
from typing import Mapping

from sentry_relay import parse_release

from sentry.models.activity import Activity
from sentry.utils.html import escape
from sentry.utils.http import absolute_uri

from .base import GroupActivityNotification


class VersionedGroupActivityNotification(GroupActivityNotification, abc.ABC):
    """Notifications which have version or release as part of their title and description"""

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)

        self.version = self.activity.data.get("version", "")

        if self.version:
            self.version_parsed = parse_release(self.version)["description"]
            self.version_url = absolute_uri(
                f"/organizations/{self.organization.slug}/releases/{self.version_parsed}/"
            )
        else:
            self.version_parsed = "an upcoming release"

    def get_params(self) -> Mapping[str, str]:
        return {"version": self.version_parsed}

    def get_html_params(self) -> Mapping[str, str]:
        html_params = {}
        if self.version:
            html_params[
                "version"
            ] = f'<a href="{self.version_url}">{escape(self.version_parsed)}</a>'

        return html_params
