from __future__ import annotations

from html import escape
from typing import Any, Mapping

from sentry.types.integrations import ExternalProviders

from .base import GroupActivityNotification


class ResolvedInReleaseActivityNotification(GroupActivityNotification):
    metrics_key = "resolved_in_release_activity"
    title = "Resolved Issue"

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        data = self.activity.data

        url = self.organization.absolute_url(
            f"/organizations/{self.organization.slug}/releases/{data['version']}/",
            query=f"project={self.project.id}",
        )

        if data.get("version"):
            return (
                "{author} marked {an issue} as resolved in {version}",
                {"version": data["version"]},
                {"version": '<a href="{}">{}</a>'.format(url, escape(data["version"]))},
            )
        return "{author} marked {an issue} as resolved in an upcoming release", {}, {}

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        data = self.activity.data
        if self.user:
            author = self.user.get_display_name()
        else:
            author = "Unknown"
        release = data["version"] if data.get("version") else "an upcoming release"
        return f"Issue marked as resolved in {release} by {author}"
