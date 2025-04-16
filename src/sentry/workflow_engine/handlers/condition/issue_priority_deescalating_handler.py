from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_PRIORITY_DEESCALATING)
class IssuePriorityDeescalatingConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        occurrence = event_data.event.occurrence
        if occurrence is None:
            raise Exception("Metric issue missing occurrence")
        previous_status = occurrence.evidence_data["previous_status"]

        group = event_data.event.group
        current_status = group.priority
        return current_status < previous_status
