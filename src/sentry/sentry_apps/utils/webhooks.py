from enum import StrEnum
from typing import Final


class SentryAppActionType(StrEnum):
    pass


class IssueActionType(SentryAppActionType):
    ASSIGNED = "assigned"
    CREATED = "created"
    IGNORED = "ignored"
    RESOLVED = "resolved"
    UNRESOLVED = "unresolved"


class ErrorActionType(SentryAppActionType):
    CREATED = "created"


class CommentActionType(SentryAppActionType):
    CREATED = "created"
    DELETED = "deleted"
    UPDATED = "updated"


class MetricAlertActionType(SentryAppActionType):
    CRITICAL = "critical"
    OPEN = "open"
    CLOSED = "closed"
    WARNING = "warning"


class IssueAlertActionType(SentryAppActionType):
    TRIGGERED = "triggered"


class InstallationActionType(SentryAppActionType):
    CREATED = "created"
    DELETED = "deleted"


_sentry_app_webhook_mapping: dict[str, list[str]] = {}


def _map_sentry_app_webhook_events(resource: str, action_type: type[SentryAppActionType]) -> str:
    # Turn action into webhook event e.g issue.created, issue.resolved, etc.
    webhook_events = [f"{resource}.{action.value}" for action in action_type._member_map_.values()]
    _sentry_app_webhook_mapping[resource] = webhook_events
    return resource


class SentryAppResourceType(StrEnum):
    ISSUE = _map_sentry_app_webhook_events("issue", IssueActionType)
    ERROR = _map_sentry_app_webhook_events("error", ErrorActionType)
    COMMENT = _map_sentry_app_webhook_events("comment", CommentActionType)
    INSTALLATION = _map_sentry_app_webhook_events("installation", InstallationActionType)
    METRIC_ALERT = _map_sentry_app_webhook_events("metric_alert", MetricAlertActionType)

    # Represents an issue alert resource
    EVENT_ALERT = _map_sentry_app_webhook_events("event_alert", IssueAlertActionType)


# When a developer selects to receive "<Resource> Webhooks" it really means
# listening to a list of specific events. This is a mapping of what those
# specific events are for each resource.
EVENT_EXPANSION: Final[dict[SentryAppResourceType, list[str]]] = {
    SentryAppResourceType.ISSUE: _sentry_app_webhook_mapping[SentryAppResourceType.ISSUE],
    SentryAppResourceType.ERROR: _sentry_app_webhook_mapping[SentryAppResourceType.ERROR],
    SentryAppResourceType.COMMENT: _sentry_app_webhook_mapping[SentryAppResourceType.COMMENT],
    SentryAppResourceType.METRIC_ALERT: _sentry_app_webhook_mapping[
        SentryAppResourceType.METRIC_ALERT
    ],
    SentryAppResourceType.EVENT_ALERT: _sentry_app_webhook_mapping[
        SentryAppResourceType.EVENT_ALERT
    ],
    SentryAppResourceType.INSTALLATION: _sentry_app_webhook_mapping[
        SentryAppResourceType.INSTALLATION
    ],
}
# We present Webhook Subscriptions per-resource (Issue, Project, etc.), not
# per-event-type (issue.created, project.deleted, etc.). These are valid
# resources a Sentry App may subscribe to.
VALID_EVENT_RESOURCES = (
    SentryAppResourceType.ISSUE,
    SentryAppResourceType.ERROR,
    SentryAppResourceType.COMMENT,
)
