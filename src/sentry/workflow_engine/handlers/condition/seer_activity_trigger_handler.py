from enum import StrEnum
from typing import Any

from sentry.models.activity import Activity
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


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


@condition_handler_registry.register(Condition.SEER_ACTIVITY_TRIGGER)
class SeerActivityTriggerHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.WORKFLOW_TRIGGER
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

        # TODO(Leander): Remove the pr_created conditionals once we update DB state
        comparison_activity_types = {
            SEER_STAGE_TO_ACTIVITY_TYPE[
                SeerActivityTriggerStage.PR_READY_FOR_REVIEW if stage == "pr_created" else stage
            ]
            for stage in comparison
            # The below check is required, since stale alerts in our DB for stages we've removed
            # may be evaluated (e.g. `rca_started`, `coding_started`).
            if stage in SEER_STAGE_TO_ACTIVITY_TYPE or stage == "pr_created"
        }
        return event.type in comparison_activity_types
