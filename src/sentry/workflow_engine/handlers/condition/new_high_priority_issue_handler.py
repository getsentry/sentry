from typing import int, Any

from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.condition.first_seen_event_handler import is_new_event
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.NEW_HIGH_PRIORITY_ISSUE)
class NewHighPriorityIssueConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.WORKFLOW_TRIGGER
    comparison_json_schema = {"type": "boolean"}

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        is_new = is_new_event(event_data)
        return is_new and event_data.group.priority == PriorityLevel.HIGH
