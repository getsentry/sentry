from enum import StrEnum
from typing import Any

from sentry.models.activity import Activity
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import UnsupportedPreviewBehavior
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


class WorkflowActivityKind(StrEnum):
    """Persisted source-event kinds, independent of action and recipient types."""

    ISSUE_ASSIGNED = "issue.assigned"
    ISSUE_MENTIONED = "issue.mentioned"


def _get_activity_kind(event_data: WorkflowEventData) -> str | None:
    event = event_data.event
    # Add concrete investigation-event matching here when its schemas are available.
    # Issue events continue to use their native Activity representation.
    if not isinstance(event, Activity):
        return None

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
    condition_result_schema = {"type": "boolean"}

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        if not isinstance(comparison, list) or not all(
            isinstance(kind, str) for kind in comparison
        ):
            return False

        kind = _get_activity_kind(event_data)
        return kind is not None and kind in comparison
