from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import urlencode

import orjson
from sentry_relay.processing import parse_release

from sentry.integrations.types import ExternalProviders
from sentry.models.activity import Activity

from .base import GroupActivityNotification


class ResolvedInReleaseActivityNotification(GroupActivityNotification):
    metrics_key = "resolved_in_release_activity"
    title = "Resolved Issue"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.version = self.activity.data.get("version", "")
        self.version_parsed = parse_release(self.version, json_loads=orjson.loads)["description"]

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
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

            params = {
                "url": url,
                "version": self.version_parsed,
            }

            return (
                "{author} marked {an issue} as resolved in {version}",
                '{author} marked {an issue} as resolved in <a href="{url}">{version}</a>',
                params,
            )
        return "{author} marked {an issue} as resolved in an upcoming release", None, {}

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        if self.user:
            author = self.user.get_display_name()
        else:
            author = "Unknown"
        release = self.version_parsed if self.version else "an upcoming release"
        return f"Issue marked as resolved in {release} by {author}"
