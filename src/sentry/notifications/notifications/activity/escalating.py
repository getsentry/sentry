from __future__ import annotations

from typing import Any, Mapping, Optional

from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders

from .base import GroupActivityNotification


class EscalatingActivityNotification(GroupActivityNotification):
    message_builder = "SlackNotificationsMessageBuilder"
    metrics_key = "escalating_activity"
    title = "Issue marked as escalating"

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:

        return self.title

    def get_description(self) -> tuple[str, Optional[str], Mapping[str, Any]]:
        forecast = int(self.activity.data.get("forecast", 0))
        expired_snooze = self.activity.data.get("expired_snooze")

        if forecast:
            return (
                "Sentry flagged this issue as escalating because over {forecast} {event} happened in an hour.",
                None,
                {"forecast": forecast, "event": "event" if forecast == 1 else "events"},
            )

        if expired_snooze:
            return (
                "Sentry flagged this issue as escalating because your archive condition has expired.",
                None,
                {},
            )

        # Return a default basic message
        return ("Sentry flagged this issue as escalating.", None, {})

    def get_message_description(self, recipient: RpcActor, provider: ExternalProviders) -> Any:
        return self.get_context()["text_description"]
