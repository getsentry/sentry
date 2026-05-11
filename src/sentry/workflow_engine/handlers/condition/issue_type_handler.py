from collections import OrderedDict
from typing import Any

from django.utils.functional import classproperty

from sentry.issues import grouptype
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


def get_type_choices() -> OrderedDict[str, str]:
    """Generate choices from all registered group types."""
    type_choices = OrderedDict()
    for group_type_cls in grouptype.registry.all():
        if not group_type_cls.released:
            continue
        # Use slug as key, description for display
        display_name = getattr(group_type_cls, "description", None) or group_type_cls.slug
        type_choices[group_type_cls.slug] = display_name
    return type_choices


TYPE_CHOICES = get_type_choices()
INCLUDE_CHOICES = OrderedDict([("true", "equal to"), ("false", "not equal to")])


def get_all_valid_type_slugs() -> list[str]:
    return list(gt.slug for gt in grouptype.registry.all())


@condition_handler_registry.register(Condition.ISSUE_TYPE)
class IssueTypeConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES
    label_template = "The issue's type is {include} {value}"

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

    @classmethod
    def render_label(cls, condition_data: dict[str, Any]) -> str:
        value = condition_data["value"]
        title = TYPE_CHOICES.get(value)
        issue_type_name = title if title else ""
        include_label = INCLUDE_CHOICES.get(condition_data.get("include", "true"), "equal to")
        return cls.label_template.format(include=include_label, value=issue_type_name)
