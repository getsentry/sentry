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

    # External Requests
    EXTERNAL_REQUEST = "external_request"

    # Authorizations
    AUTHORIZATIONS = "authorizations"

    # Managing Sentry Apps
    MANAGEMENT = "management"


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

    # Preparation fail
    MISSING_SENTRY_APP = "missing_sentry_app"
    MISSING_INSTALLATION = "missing_installation"
    MISSING_EVENT = "missing_event"
    INVALID_EVENT = "invalid_event"
    MISSING_SERVICEHOOK = "missing_servicehook"
    EVENT_NOT_IN_SERVCEHOOK = "event_not_in_servicehook"
    MISSING_ISSUE_OCCURRENCE = "missing_issue_occurrence"
    MISSING_USER = "missing_user"
    MULTIPLE_INSTALLATIONS = "multiple_installations"


class SentryAppWebhookHaltReason(StrEnum):
    """Reasons why sentry app webhooks can halt"""

    GOT_CLIENT_ERROR = "got_client_error"
    INTEGRATOR_ERROR = "integrator_error"
    MISSING_INSTALLATION = "missing_installation"
    RESTRICTED_IP = "restricted_ip"
    CONNECTION_RESET = "connection_reset"
    HARD_TIMEOUT = "hard_timeout"
    CIRCUIT_BROKEN = "circuit_broken"
    EMAIL_FAILED = "email_failed"
    APP_DISABLED = "app_disabled"
    INNER_TIMEOUT = "inner_timeout"


class SentryAppExternalRequestFailureReason(StrEnum):
    """Reasons why sentry app external request processes can fail"""

    MISSING_URL = "missing_url"
    INVALID_URI = "invalid_uri"
    UNEXPECTED_ERROR = "unexpected_error"
    INVALID_EVENT = "invalid_event"


class SentryAppExternalRequestHaltReason(StrEnum):
    """Reasons why sentry app external request processes can halt"""

    MISSING_FIELDS = "missing_fields"
    BAD_RESPONSE = "bad_response"
