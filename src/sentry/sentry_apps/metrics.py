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
        tokens = ("sentry_app", self.operation_type, str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        return {
            "operation_type": self.operation_type,
            "event_type": self.event_type,
        }

    def get_extras(self) -> Mapping[str, Any]:
        return {
            "event_type": self.event_type,
            "operation_type": self.operation_type,
        }


class SentryAppWebhookFailureReason(StrEnum):
    """Reasons why sentry app webhooks can fail"""

    # Preperation fail
    MISSING_SENTRY_APP = "missing_sentry_app"
    MISSING_INSTALLATION = "missing_installation"
    MISSING_EVENT = "missing_event"
    INVALID_EVENT = "invalid_event"
    MISSING_SERVICEHOOK = "missing_servicehook"
    EVENT_NOT_IN_SERVCEHOOK = "event_not_in_servicehook"
    MISSING_USER = "missing_user"


class SentryAppWebhookHaltReason(StrEnum):
    """Reasons why sentry app webhooks can halt"""

    GOT_CLIENT_ERROR = "got_client_error"
    INTEGRATOR_ERROR = "integrator_error"
