from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING, Any, Final

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
    TRIAGE_STARTED = "triage_started"
    TRIAGE_COMPLETED = "triage_completed"
    IMPACT_ASSESSMENT_STARTED = "impact_assessment_started"
    IMPACT_ASSESSMENT_COMPLETED = "impact_assessment_completed"
    PR_CREATED = "pr_created"


class PreprodArtifactActionType(SentryAppActionType):
    SIZE_ANALYSIS_COMPLETED = "size_analysis_completed"
    BUILD_DISTRIBUTION_COMPLETED = "build_distribution_completed"


class SentryAppResourceType(StrEnum):
    @staticmethod
    def map_sentry_app_webhook_events(
        resource: str, action_type: type[SentryAppActionType]
    ) -> list[str]:
        # Turn resource + action into webhook event e.g issue.created, issue.resolved, etc.
        webhook_events = [
            f"{resource}.{action.value}" for action in action_type._member_map_.values()
        ]
        return webhook_events

    ISSUE = "issue"
    ERROR = "error"
    COMMENT = "comment"
    INSTALLATION = "installation"
    METRIC_ALERT = "metric_alert"
    SEER = "seer"
    PREPROD_ARTIFACT = "preprod_artifact"

    # Represents an issue alert resource
    EVENT_ALERT = "event_alert"


# When a developer selects to receive "<Resource> Webhooks" it really means
# listening to a list of specific events. This is a mapping of what those
# specific events are for each resource.
EVENT_EXPANSION: Final[dict[SentryAppResourceType, list[str]]] = {
    SentryAppResourceType.ISSUE: SentryAppResourceType.map_sentry_app_webhook_events(
        SentryAppResourceType.ISSUE.value, IssueActionType
    ),
    SentryAppResourceType.ERROR: SentryAppResourceType.map_sentry_app_webhook_events(
        SentryAppResourceType.ERROR.value, ErrorActionType
    ),
    SentryAppResourceType.COMMENT: SentryAppResourceType.map_sentry_app_webhook_events(
        SentryAppResourceType.COMMENT.value, CommentActionType
    ),
    SentryAppResourceType.SEER: SentryAppResourceType.map_sentry_app_webhook_events(
        SentryAppResourceType.SEER.value, SeerActionType
    ),
    SentryAppResourceType.PREPROD_ARTIFACT: SentryAppResourceType.map_sentry_app_webhook_events(
        SentryAppResourceType.PREPROD_ARTIFACT.value, PreprodArtifactActionType
    ),
}
# We present Webhook Subscriptions per-resource (Issue, Project, etc.), not
# per-event-type (issue.created, project.deleted, etc.). These are valid
# resources a Sentry App may subscribe to.
VALID_EVENT_RESOURCES = EVENT_EXPANSION.keys()


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
