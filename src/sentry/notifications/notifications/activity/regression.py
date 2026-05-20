from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping
from typing import Any
from urllib.parse import urlencode

import orjson
from sentry_relay.processing import parse_release

from sentry.integrations.types import ExternalProviders
from sentry.models.activity import Activity
from sentry.types.actor import Actor

from .base import GroupActivityNotification

logger = logging.getLogger(__name__)


class RegressionActivityNotification(GroupActivityNotification):
    metrics_key = "regression_activity"
    title = "Regression"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.version = self.activity.data.get("version", "")
        self.version_parsed = parse_release(self.version, json_loads=orjson.loads)["description"]

        # Load the event that triggered the regression so notifications show
        # its details instead of stale group-level metadata.
        self.event = None
        event_id = self.activity.data.get("event_id")
        if event_id:
            try:
                from sentry import eventstore

                self.event = eventstore.backend.get_event_by_id(
                    self.project.id, event_id
                )
            except Exception:
                logger.info(
                    "regression_activity.event_lookup_failed",
                    extra={"event_id": event_id, "project_id": self.project.id},
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

    def build_attachment_title(self, recipient: Actor) -> str:
        from sentry.integrations.messaging.message_builder import build_attachment_title

        return build_attachment_title(self.event or self.group)

    def get_title_link(self, recipient: Actor, provider: ExternalProviders) -> str | None:
        from sentry.integrations.messaging.message_builder import get_title_link

        return get_title_link(
            self.group, self.event, bool(self.event), True, self, provider
        )

    def get_group_context(self) -> MutableMapping[str, Any]:
        ctx = super().get_group_context()
        if self.event is not None:
            ctx["event"] = self.event
        return ctx

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
