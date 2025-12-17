from typing import Any

from sentry.models.group import GroupStatus
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_RESOLUTION_CHANGE)
class IssueResolutionConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.WORKFLOW_TRIGGER

    comparison_json_schema = {
        "type": "boolean",
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group
        is_resolved = group.status == GroupStatus.RESOLVED
        return is_resolved == comparison
