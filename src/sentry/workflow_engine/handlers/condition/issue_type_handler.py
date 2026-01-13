from typing import Any

from sentry.issues import grouptype
from sentry.issues.grouptype import GroupType, InvalidGroupTypeError
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


def get_all_valid_type_ids() -> list:
    return list(grouptype.registry.get_all_group_type_ids())


@condition_handler_registry.register(Condition.ISSUE_TYPE)
class IssueTypeConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES

    @property
    def comparison_json_schema(self) -> Any:
        return {
            "type": "object",
            "properties": {"value": {"type": "integer", "enum": get_all_valid_type_ids()}},
            "required": ["value"],
            "additionalProperties": False,
        }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group
        try:
            value: GroupType = grouptype.registry.get_by_type_id(int(comparison["value"]))
        except (TypeError, InvalidGroupTypeError, KeyError):
            return False

        return group.issue_type == value
