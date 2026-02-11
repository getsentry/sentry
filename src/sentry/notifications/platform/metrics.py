from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import EventLifecycleMetric
from sentry.notifications.platform.templates.types import NotificationTemplateSource
from sentry.notifications.platform.types import NotificationCategory, NotificationProviderKey


class NotificationInteractionType(StrEnum):
    """Actions involved in notifications"""

    NOTIFY_TARGET_SYNC = "notify_target_sync"
    NOTIFY_TARGET_ASYNC = "notify_target_async"


@dataclass
class NotificationEventLifecycleMetric(EventLifecycleMetric):
    interaction_type: NotificationInteractionType
    # The template/source of the notification
    notification_source: NotificationTemplateSource
    # The sender of the notification
    notification_provider: NotificationProviderKey | None = None
    # The category of the notification
    notification_category: NotificationCategory | None = None

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
        if self.notification_category:
            tags["category"] = self.notification_category

        return tags
