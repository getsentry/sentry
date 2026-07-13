from __future__ import annotations

from collections.abc import Collection
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Final

from sentry.sentry_apps.event_types import SentryAppEventType

if TYPE_CHECKING:
    from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent


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
    RESOLVED = "resolved"
    WARNING = "warning"


class IssueAlertActionType(SentryAppActionType):
    TRIGGERED = "triggered"


class ActivityAlertActionType(SentryAppActionType):
    TRIGGERED = "triggered"


class InstallationActionType(SentryAppActionType):
    CREATED = "created"
    DELETED = "deleted"


class SeerActionType(SentryAppActionType):
    ROOT_CAUSE_STARTED = "root_cause_started"
    ROOT_CAUSE_COMPLETED = "root_cause_completed"
    SOLUTION_STARTED = "solution_started"
    SOLUTION_COMPLETED = "solution_completed"
    CODING_STARTED = "coding_started"
    CODING_COMPLETED = "coding_completed"
    PR_CREATED = "pr_created"
    ITERATION_STARTED = "iteration_started"
    ITERATION_COMPLETED = "iteration_completed"


class PreprodArtifactActionType(SentryAppActionType):
    SIZE_ANALYSIS_COMPLETED = "size_analysis_completed"
    BUILD_DISTRIBUTION_COMPLETED = "build_distribution_completed"


class SentryAppResourceType(StrEnum):
    ISSUE = "issue"
    ERROR = "error"
    COMMENT = "comment"
    INSTALLATION = "installation"
    METRIC_ALERT = "metric_alert"
    SEER = "seer"
    PREPROD_ARTIFACT = "preprod_artifact"

    # Represents an issue alert resource
    EVENT_ALERT = "event_alert"
    ACTIVITY_ALERT = "activity_alert"


# When a developer selects to receive "<Resource> Webhooks" it really means
# listening to a list of specific events. This maps each resource to those
# events, referencing SentryAppEventType as the single source of event tokens.
EVENT_EXPANSION: Final[dict[SentryAppResourceType, list[SentryAppEventType]]] = {
    SentryAppResourceType.ISSUE: [
        SentryAppEventType.ISSUE_ASSIGNED,
        SentryAppEventType.ISSUE_CREATED,
        SentryAppEventType.ISSUE_IGNORED,
        SentryAppEventType.ISSUE_RESOLVED,
        SentryAppEventType.ISSUE_UNRESOLVED,
    ],
    SentryAppResourceType.ERROR: [SentryAppEventType.ERROR_CREATED],
    SentryAppResourceType.COMMENT: [
        SentryAppEventType.COMMENT_CREATED,
        SentryAppEventType.COMMENT_DELETED,
        SentryAppEventType.COMMENT_UPDATED,
    ],
    SentryAppResourceType.SEER: [
        SentryAppEventType.SEER_ROOT_CAUSE_STARTED,
        SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
        SentryAppEventType.SEER_SOLUTION_STARTED,
        SentryAppEventType.SEER_SOLUTION_COMPLETED,
        SentryAppEventType.SEER_CODING_STARTED,
        SentryAppEventType.SEER_CODING_COMPLETED,
        SentryAppEventType.SEER_PR_CREATED,
        SentryAppEventType.SEER_ITERATION_STARTED,
        SentryAppEventType.SEER_ITERATION_COMPLETED,
    ],
    SentryAppResourceType.PREPROD_ARTIFACT: [
        SentryAppEventType.PREPROD_ARTIFACT_SIZE_ANALYSIS_COMPLETED,
        SentryAppEventType.PREPROD_ARTIFACT_BUILD_DISTRIBUTION_COMPLETED,
    ],
}
# We present Webhook Subscriptions per-resource (Issue, Project, etc.), not
# per-event-type (issue.created, project.deleted, etc.). These are valid
# resources a Sentry App may subscribe to.
VALID_EVENT_RESOURCES = EVENT_EXPANSION.keys()
EVENT_TO_RESOURCE: Final[dict[str, SentryAppResourceType]] = {
    event: resource for resource, events in EVENT_EXPANSION.items() for event in events
}

# Renamed events were never migrated in stored subscriptions, so old and new
# names are equivalent when matching an exact subscription.
_LEGACY_EVENT_ALIASES: Final[dict[str, str]] = {
    SentryAppEventType.ISSUE_IGNORED: SentryAppEventType.ISSUE_ARCHIVED,
}


def resource_of(event: str) -> SentryAppResourceType | None:
    """The resource a subscribable event belongs to ("issue.resolved" -> ISSUE), else None."""
    return EVENT_TO_RESOURCE.get(event)


def has_granular_events(events: Collection[str] | None) -> bool:
    """Whether any entry is an individual event rather than a whole resource."""
    return any(event in EVENT_TO_RESOURCE for event in events or ())


def is_subscribed(stored_events: Collection[str], event: str) -> bool:
    """
    Whether a stored subscription covers a fired event.

    Only the exact event matches (plus its legacy alias, for installs that
    stored the pre-rename name). Subscribing to a whole resource stores every
    event it expands to, so resource-level subscriptions match all of that
    resource's events by construction.
    """
    if resource_of(event) is None:
        return False
    alias = _LEGACY_EVENT_ALIASES.get(event)
    return event in stored_events or (alias is not None and alias in stored_events)


def find_alert_rule_action_ui_component(
    app_platform_event: AppPlatformEvent[dict[str, Any]],
) -> bool:
    """
    Returns True if the metric alert event contains a sentry app action with UI component settings.
    Used to gate recording of AlertRuleUiComponentWebhookSentEvent analytics.
    """
    triggers = (
        getattr(app_platform_event, "data", {})
        .get("metric_alert", {})
        .get("alert_rule", {})
        .get("triggers", [])
    )
    actions = [
        action
        for trigger in triggers
        for action in trigger.get("actions", [])
        if (action.get("type") == "sentry_app" and action.get("settings") is not None)
    ]
    return bool(len(actions))
