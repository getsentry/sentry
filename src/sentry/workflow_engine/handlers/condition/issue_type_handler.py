from typing import Any

from django.utils.functional import classproperty

from sentry.issues import grouptype
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


def get_all_valid_type_slugs() -> list[str]:
    return list(gt.slug for gt in grouptype.registry.all())


@condition_handler_registry.register(Condition.ISSUE_TYPE)
class IssueTypeConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES

    @classproperty
    def comparison_json_schema(cls) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "value": {"type": "string", "enum": get_all_valid_type_slugs()},
                "include": {"type": "boolean"},
            },
            "required": ["value"],  # if include is not present, then default to True
            "additionalProperties": False,
        }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group
        try:
            comparison_value = comparison["value"]
            if not isinstance(comparison_value, str):
                return False
            value = grouptype.registry.get_by_slug(comparison_value)
            if value is None:
                return False
        except (TypeError, KeyError):
            return False

        include = comparison.get("include", True)

        return group.issue_type == value if include else group.issue_type != value
