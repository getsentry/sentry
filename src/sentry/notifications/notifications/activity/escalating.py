from __future__ import annotations

from typing import Any, Mapping

from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders

from .base import GroupActivityNotification


class EscalatingActivityNotification(GroupActivityNotification):
    message_builder = "SlackNotificationsMessageBuilder"
    metrics_key = "escalating_activity"
    title = "Escalating"
    template_path = "sentry/emails/activity/note"

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:

        return "Issue marked as escalating"

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        forecast = int(self.activity.data["forecast"])
        return (
            "Sentry flagged this issue as escalating because over {forecast} {event} happened in an hour",
            {"forecast": forecast, "event": "event" if forecast == 1 else "events"},
            {},
        )

    def get_message_description(self, recipient: RpcActor, provider: ExternalProviders) -> Any:
        return self.get_context()["text_description"]
