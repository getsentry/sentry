from typing import Any

from sentry.models.activity import Activity
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


class SeerActivityStage:
    RCA_STARTED = "rca_started"
    RCA_COMPLETED = "rca_completed"
    SOLUTION_STARTED = "solution_started"
    SOLUTION_COMPLETED = "solution_completed"
    CODING_STARTED = "coding_started"
    CODING_COMPLETED = "coding_completed"
    PR_CREATED = "pr_created"


SEER_ACTIVITY_STAGES = [
    SeerActivityStage.RCA_STARTED,
    SeerActivityStage.RCA_COMPLETED,
    SeerActivityStage.SOLUTION_STARTED,
    SeerActivityStage.SOLUTION_COMPLETED,
    SeerActivityStage.CODING_STARTED,
    SeerActivityStage.CODING_COMPLETED,
    SeerActivityStage.PR_CREATED,
]

SEER_STAGE_TO_ACTIVITY_TYPE: dict[str, int] = {
    SeerActivityStage.RCA_STARTED: ActivityType.SEER_RCA_STARTED.value,
    SeerActivityStage.RCA_COMPLETED: ActivityType.SEER_RCA_COMPLETED.value,
    SeerActivityStage.SOLUTION_STARTED: ActivityType.SEER_SOLUTION_STARTED.value,
    SeerActivityStage.SOLUTION_COMPLETED: ActivityType.SEER_SOLUTION_COMPLETED.value,
    SeerActivityStage.CODING_STARTED: ActivityType.SEER_CODING_STARTED.value,
    SeerActivityStage.CODING_COMPLETED: ActivityType.SEER_CODING_COMPLETED.value,
    SeerActivityStage.PR_CREATED: ActivityType.SEER_PR_CREATED.value,
}


@condition_handler_registry.register(Condition.SEER_ACTIVITY_TRIGGER)
class SeerActivityTriggerCondition(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.WORKFLOW_TRIGGER
    comparison_json_schema = {
        "type": "array",
        "items": {"type": "string", "enum": SEER_ACTIVITY_STAGES},
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

        expected_activity_types = {
            SEER_STAGE_TO_ACTIVITY_TYPE[stage]
            for stage in comparison
            if stage in SEER_STAGE_TO_ACTIVITY_TYPE
        }
        return event.type in expected_activity_types
