from typing import Any

from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.EXISTING_HIGH_PRIORITY_ISSUE)
class ExistingHighPriorityIssueConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.WORKFLOW_TRIGGER
    comparison_json_schema = {"type": "boolean"}

    @staticmethod
    def evaluate_value(job: WorkflowEventData, comparison: Any) -> bool:
        state = job.group_state
        if state is None or state["is_new"]:
            return False

        is_escalating = bool(job.has_reappeared or job.has_escalated)
        return is_escalating and job.event.group.priority == PriorityLevel.HIGH
