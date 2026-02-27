from collections import OrderedDict
from typing import Any

from sentry.issues.grouptype import GroupCategory
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData

CATEGORY_CHOICES = OrderedDict([(f"{gc.value}", str(gc.name).lower()) for gc in GroupCategory])
INCLUDE_CHOICES = OrderedDict([("true", "equal to"), ("false", "not equal to")])


@condition_handler_registry.register(Condition.ISSUE_CATEGORY)
class IssueCategoryConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES
    label_template = "The issue's category is {include} {value}"

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "value": {"type": "integer", "enum": [*GroupCategory]},
            "include": {"type": "boolean"},
        },
        "required": ["value"],  # if include is not present, then default to True
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group

        try:
            value: GroupCategory = GroupCategory(int(comparison["value"]))
        except (TypeError, ValueError, KeyError):
            return False

        include = comparison.get("include", True)

        try:
            issue_category = group.issue_category
            issue_category_v2 = group.issue_category_v2
        except ValueError:
            return False

        if include:
            return bool(value == issue_category or value == issue_category_v2)

        return bool(value != issue_category and value != issue_category_v2)

    @classmethod
    def render_label(cls, condition_data: dict[str, Any]) -> str:
        value = condition_data["value"]
        title = CATEGORY_CHOICES.get(value)
        group_category_name = title.title() if title else ""
        include_label = INCLUDE_CHOICES.get(condition_data.get("include", "true"), "equal to")
        return cls.label_template.format(include=include_label, value=group_category_name)
