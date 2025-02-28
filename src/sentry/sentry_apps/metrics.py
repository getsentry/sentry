from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import EventLifecycleMetric


class SentryAppInteractionType(StrEnum):
    """Actions that Sentry Apps can do"""

    # Webhook actions
    PREPARE_WEBHOOK = "prepare_webhook"
    SEND_WEBHOOK = "send_webhook"


@dataclass
class SentryAppInteractionEvent(EventLifecycleMetric):
    """An event under the Sentry App umbrella"""

    operation_type: SentryAppInteractionType
    event_type: str

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = ("sentry_app", str(outcome))
        return ".".join(tokens)

    def get_event_type(self) -> str:
        return self.event_type if self.event_type else ""

    def get_metric_tags(self) -> Mapping[str, str]:
        return {
            "operation_type": self.operation_type,
            "event_type": self.event_type,
        }

    def get_extras(self) -> Mapping[str, Any]:
        return {
            "event_type": self.get_event_type(),
            "operation_type": self.operation_type,
        }
