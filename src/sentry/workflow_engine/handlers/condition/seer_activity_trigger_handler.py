from enum import StrEnum
from typing import Any

from django.db.models import Q

from sentry.models.activity import Activity
from sentry.types.activity import ActivityType
from sentry.utils.action_log.activity_translator import ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import (
    AlertPreviewPlan,
    InvalidPreviewConfiguration,
    WorkflowTriggerPreviewBehavior,
)
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


class SeerActivityTriggerStage(StrEnum):
    """
    The stages that are configurable options for this SeerActivityTrigger DataCondition.
    """

    RCA_COMPLETED = "rca_completed"
    SOLUTION_COMPLETED = "solution_completed"
    CODING_COMPLETED = "coding_completed"
    PR_READY_FOR_REVIEW = "pr_ready_for_review"


SEER_STAGE_TO_ACTIVITY_TYPE: dict[str, int] = {
    SeerActivityTriggerStage.RCA_COMPLETED: ActivityType.SEER_RCA_COMPLETED.value,
    SeerActivityTriggerStage.SOLUTION_COMPLETED: ActivityType.SEER_SOLUTION_COMPLETED.value,
    SeerActivityTriggerStage.CODING_COMPLETED: ActivityType.SEER_CODING_COMPLETED.value,
    SeerActivityTriggerStage.PR_READY_FOR_REVIEW: ActivityType.SEER_PR_READY_FOR_REVIEW.value,
}
"""
Maps the DataCondition's configurable stages to their ActivityType (from the Activity model).
This is the source of truth for what can be configured and evaluated.
"""
LEGACY_SEER_STAGE_ALIASES = {
    "pr_created": SeerActivityTriggerStage.PR_READY_FOR_REVIEW,
}


def _activity_types_for_stages(stages: list[Any]) -> list[int]:
    normalized_stages = [
        LEGACY_SEER_STAGE_ALIASES.get(stage, stage) for stage in stages if isinstance(stage, str)
    ]
    return [
        SEER_STAGE_TO_ACTIVITY_TYPE[stage]
        for stage in normalized_stages
        if stage in SEER_STAGE_TO_ACTIVITY_TYPE
    ]


class SeerActivityPreviewBehavior(WorkflowTriggerPreviewBehavior):
    def add_to_preview(self, plan: AlertPreviewPlan, comparison: Any) -> None:
        if not isinstance(comparison, list) or not all(
            isinstance(stage, str) for stage in comparison
        ):
            raise InvalidPreviewConfiguration("Seer stages must be a list of strings")

        action_types = [
            ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE[activity_type].get_type().value
            for activity_type in _activity_types_for_stages(comparison)
        ]
        plan.add_group_action_log_candidates(Q(type__in=action_types))


@condition_handler_registry.register(Condition.SEER_ACTIVITY_TRIGGER)
class SeerActivityTriggerHandler(WorkflowTriggerDataConditionHandler):
    preview_behavior = SeerActivityPreviewBehavior()
    comparison_json_schema = {
        "type": "array",
        "items": {"type": "string", "enum": list(SEER_STAGE_TO_ACTIVITY_TYPE.keys())},
        "minItems": 1,
        "uniqueItems": True,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        event = event_data.event
        if not isinstance(event, Activity):
            return False

        if not isinstance(comparison, list):
            return False

        return event.type in _activity_types_for_stages(comparison)
