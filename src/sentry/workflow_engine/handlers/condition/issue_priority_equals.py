from typing import Any

from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_PRIORITY_EQUALS)
class IssuePriorityCondition(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES
    comparison_json_schema = {
        "type": "integer",
        "enum": [*PriorityLevel],
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        # Some stored comparisons are priority strings instead of ints.
        # Tolerate until cleaned up (ISWF-3433).
        if isinstance(comparison, str):
            comparison = PriorityLevel.from_str(comparison)
            if comparison is None:
                return False

        group = event_data.group
        return group.priority == comparison
