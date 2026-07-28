from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import urlencode

import orjson
from sentry_relay.processing import parse_release

from sentry.integrations.types import ExternalProviders
from sentry.models.activity import Activity

from .base import GroupActivityNotification


class RegressionActivityNotification(GroupActivityNotification):
    metrics_key = "regression_activity"
    title = "Regression"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.version = self.activity.data.get("version", "")
        self.version_parsed = parse_release(self.version, json_loads=orjson.loads)["description"]
        self.regression_event_id: str | None = self.activity.data.get("event_id")
        self._apply_event_metadata()

    def _apply_event_metadata(self) -> None:
        """
        The group's in-DB metadata may be stale when the notification fires because
        _handle_regression queues the notification *before* buffer_incr flushes the
        new event's data. The activity carries a snapshot of the triggering event's
        metadata, so we patch the in-memory group to ensure the notification shows
        the correct title and message.
        """
        event_metadata = self.activity.data.get("event_metadata")
        if event_metadata is None:
            return
        group_data = {**(self.group.data or {})}
        group_data["metadata"] = event_metadata
        if "event_title" in self.activity.data:
            group_data["title"] = self.activity.data["event_title"]
        if "event_type" in self.activity.data:
            group_data["type"] = self.activity.data["event_type"]
        self.group.data = group_data

    def get_group_link(self) -> str:
        referrer = self.get_referrer(ExternalProviders.EMAIL)
        return str(
            self.group.get_absolute_url(
                params={"referrer": referrer, "notification_uuid": self.notification_uuid},
                event_id=self.regression_event_id,
            )
        )

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        text_message, html_message, params = "{author} marked {an issue} as a regression", None, {}

        if self.version:
            version_url = self.organization.absolute_url(
                f"/organizations/{self.organization.slug}/releases/{self.version_parsed}/",
                query=urlencode(
                    {"referrer": self.metrics_key, "notification_uuid": self.notification_uuid}
                ),
            )

            html_message = text_message + ' in <a href="{url}">{version}</a>'
            text_message += " in {version}"

            params["url"] = version_url
            params["version"] = self.version_parsed

        return text_message, html_message, params

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        text = "Issue marked as regression"
        if self.version:
            version_url = self.organization.absolute_url(
                f"/organizations/{self.organization.slug}/releases/{self.version}/",
                query=urlencode(
                    {"referrer": self.metrics_key, "notification_uuid": self.notification_uuid}
                ),
            )
            text += f" in release {self.format_url(text=self.version_parsed, url=version_url, provider=provider)}"
        return text
