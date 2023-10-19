from __future__ import annotations

from html import escape
from typing import Any, Mapping
from urllib.parse import urlencode

from sentry_relay.processing import parse_release

from sentry.models.activity import Activity
from sentry.types.integrations import ExternalProviders

from .base import GroupActivityNotification


class ResolvedInReleaseActivityNotification(GroupActivityNotification):
    metrics_key = "resolved_in_release_activity"
    title = "Resolved Issue"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.version = self.activity.data.get("version", "")
        self.version_parsed = parse_release(self.version)["description"]

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        if self.version:
            url = self.organization.absolute_url(
                f"/organizations/{self.organization.slug}/releases/{self.version}/",
                query=urlencode(
                    {
                        "project": self.project.id,
                        "referrer": self.metrics_key,
                        "notification_uuid": self.notification_uuid,
                    }
                ),
            )

            return (
                "{author} marked {an issue} as resolved in {version}",
                {"version": self.version_parsed},
                {"version": f'<a href="{url}">{escape(self.version_parsed)}</a>'},
            )
        return "{author} marked {an issue} as resolved in an upcoming release", {}, {}

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        if self.user:
            author = self.user.get_display_name()
        else:
            author = "Unknown"
        release = self.version_parsed if self.version else "an upcoming release"
        return f"Issue marked as resolved in {release} by {author}"
