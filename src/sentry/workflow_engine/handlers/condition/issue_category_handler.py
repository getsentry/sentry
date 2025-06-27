from typing import Any

from sentry.issues.grouptype import GroupCategory
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_CATEGORY)
class IssueCategoryConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "value": {"type": "integer", "enum": [*GroupCategory]},
        },
        "required": ["value"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group

        try:
            value: GroupCategory = GroupCategory(int(comparison["value"]))
        except (TypeError, ValueError, KeyError):
            return False

        try:
            issue_category = group.issue_category
            issue_category_v2 = group.issue_category_v2
        except ValueError:
            return False

        return bool(value == issue_category or value == issue_category_v2)
