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


class SentryAppWebhookHaltReason(StrEnum):
    """Reasons why sentry app webhooks can halt"""

    GOT_CLIENT_ERROR = "got_client_error"
    INTEGRATOR_ERROR = "integrator_error"
    MISSING_INSTALLATION = "missing_installation"
    RESTRICTED_IP = "restricted_ip"
    CONNECTION_RESET = "connection_reset"


class SentryAppExternalRequestFailureReason(StrEnum):
    """Reasons why sentry app external request processes can fail"""

    MISSING_URL = "missing_url"
    UNEXPECTED_ERROR = "unexpected_error"
    INVALID_EVENT = "invalid_event"


class SentryAppExternalRequestHaltReason(StrEnum):
    """Reasons why sentry app external request processes can halt"""

    MISSING_FIELDS = "missing_fields"
    BAD_RESPONSE = "bad_response"


class SentryAppEventType(StrEnum):
    """Events/features that Sentry Apps can do"""

    # event webhooks
    ERROR_CREATED = "error.created"
    ISSUE_CREATED = "issue.created"

    # issue alert webhooks
    EVENT_ALERT_TRIGGERED = "event_alert.triggered"

    # external request webhooks
    EXTERNAL_ISSUE_CREATED = "external_issue.created"
    EXTERNAL_ISSUE_LINKED = "external_issue.linked"
    SELECT_OPTIONS_REQUESTED = "select_options.requested"
    ALERT_RULE_ACTION_REQUESTED = "alert_rule_action.requested"

    # metric alert webhooks
    METRIC_ALERT_OPEN = "metric_alert.open"
    METRIC_ALERT_RESOLVED = "metric_alert.resolved"
    METRIC_ALERT_CRITICAL = "metric_alert.critical"
    METRIC_ALERT_WARNING = "metric_alert.warning"

    # comment webhooks
    COMMENT_CREATED = "comment.created"
    COMMENT_UPDATED = "comment.updated"
    COMMENT_DELETED = "comment.deleted"

    # installation webhooks
    INSTALLATION_CREATED = "installation.created"
    INSTALLATION_DELETED = "installation.deleted"

    # workflow notification
    ISSUE_IGNORED = "issue.ignored"
    ISSUE_ARCHIVED = "issue.archived"
    ISSUE_UNRESOLVED = "issue.unresolved"
    ISSUE_RESOLVED = "issue.resolved"
    ISSUE_ASSIGNED = "issue.assigned"

    # authorizations
    GRANT_EXCHANGER = "grant_exchanger"
    REFRESHER = "refresher"
    MANUAL_REFRESHER = "manual_refresher"

    # management
    APP_CREATE = "app_create"
    APP_UPDATE = "app_update"
    REQUESTS = "requests"
    WEBHOOK_UPDATE = "webhook_update"
    INSTALLATION_CREATE = "install_create"
    INSTALLATION_WEBHOOK_UPDATE = "installation_webhook_update"

    # seer webhooks
    SEER_ROOT_CAUSE_STARTED = "seer.root_cause_started"
    SEER_ROOT_CAUSE_COMPLETED = "seer.root_cause_completed"
    SEER_SOLUTION_STARTED = "seer.solution_started"
    SEER_SOLUTION_COMPLETED = "seer.solution_completed"
    SEER_CODING_STARTED = "seer.coding_started"
    SEER_CODING_COMPLETED = "seer.coding_completed"
    SEER_TRIAGE_STARTED = "seer.triage_started"
    SEER_TRIAGE_COMPLETED = "seer.triage_completed"
    SEER_IMPACT_ASSESSMENT_STARTED = "seer.impact_assessment_started"
    SEER_IMPACT_ASSESSMENT_COMPLETED = "seer.impact_assessment_completed"
    SEER_PR_CREATED = "seer.pr_created"
