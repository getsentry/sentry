from collections.abc import Mapping
from enum import StrEnum

from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import EventLifecycleMetric
from sentry.notifications.platform.types import NotificationProviderKey


class NotificationInteractionType(StrEnum):
    """Actions involved in notifications"""

    NOTIFY_TARGET_SYNC = "notify_target_sync"


class NotificationEventLifecycleMetric(EventLifecycleMetric):
    interaction_type: NotificationInteractionType
    # The template/source of the notification
    notification_source: str
    # The sender of the notification
    notification_provider: NotificationProviderKey | None

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = ("notifications", "slo", str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        tags = {
            "interaction_type": self.interaction_type,
            "notification_source": self.notification_source,
        }

        if self.notification_provider:
            tags["notification_provider"] = self.notification_provider
        return tags
