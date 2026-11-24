from enum import StrEnum
from typing import Any

from sentry.models.activity import Activity
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import UnsupportedPreviewBehavior
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


class WorkflowActivityKind(StrEnum):
    ISSUE_ASSIGNED = "issue.assigned"
    ISSUE_MENTIONED = "issue.mentioned"


def get_issue_activity_kind(event: Activity) -> WorkflowActivityKind | None:
    if event.type == ActivityType.ASSIGNED.value:
        return WorkflowActivityKind.ISSUE_ASSIGNED

    if event.type == ActivityType.NOTE.value and isinstance(event.data, dict):
        mentions = event.data.get("mentions", [])
        if isinstance(mentions, list) and mentions:
            return WorkflowActivityKind.ISSUE_MENTIONED

    return None


@condition_handler_registry.register(Condition.ACTIVITY_TYPE_IN)
class ActivityTypeInHandler(WorkflowTriggerDataConditionHandler):
    is_internal = True
    preview_behavior = UnsupportedPreviewBehavior(
        "Internal activity conditions are not previewable"
    )
    comparison_json_schema = {
        "type": "array",
        "items": {"type": "string", "enum": list(WorkflowActivityKind)},
        "minItems": 1,
        "uniqueItems": True,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        if not isinstance(comparison, list) or not all(
            isinstance(kind, str) for kind in comparison
        ):
            return False

        if not isinstance(event_data.event, Activity):
            return False
        kind = get_issue_activity_kind(event_data.event)
        return kind is not None and kind in comparison
