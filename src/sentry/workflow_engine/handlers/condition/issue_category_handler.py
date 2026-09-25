from collections import OrderedDict
from typing import Any

from django.db.models import Q

from sentry.issues import grouptype
from sentry.issues.grouptype import PERFORMANCE_ISSUE_CATEGORIES, GroupCategory
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import (
    ActionFilterPreviewBehavior,
    ActionFilterPreviewPlan,
    InvalidPreviewConfiguration,
)
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import (
    ActionFilterDataConditionHandler,
    DataConditionHandler,
    WorkflowEventData,
)

CATEGORY_CHOICES = OrderedDict([(f"{gc.value}", str(gc.name).lower()) for gc in GroupCategory])
INCLUDE_CHOICES = OrderedDict([("true", "equal to"), ("false", "not equal to")])


class IssueCategoryPreviewBehavior(ActionFilterPreviewBehavior):
    def filter_preview(self, plan: ActionFilterPreviewPlan, comparison: Any) -> None:
        try:
            category = GroupCategory(int(comparison["value"]))
        except (KeyError, TypeError, ValueError) as error:
            raise InvalidPreviewConfiguration("Invalid issue category") from error

        categories = (
            {GroupCategory.PERFORMANCE, *PERFORMANCE_ISSUE_CATEGORIES}
            if category == GroupCategory.PERFORMANCE
            else {category}
        )
        type_ids = {
            type_id
            for candidate_category in categories
            for type_id in grouptype.registry.get_by_category(candidate_category)
        }
        condition = Q(type__in=type_ids)
        plan.add_group_filter(condition if comparison.get("include", True) else ~condition)


@condition_handler_registry.register(Condition.ISSUE_CATEGORY)
class IssueCategoryConditionHandler(ActionFilterDataConditionHandler[WorkflowEventData]):
    preview_behavior = IssueCategoryPreviewBehavior()
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
        except ValueError:
            return False

        # TODO(CEO): we're only temporarily handling GroupCategory.PERFORMANCE_ISSUE_CATEGORIES until we can migrate away from that data
        # Until condition data is migrated, treat a stored PERFORMANCE value as matching any of the replacement categories too
        if value == GroupCategory.PERFORMANCE:
            category_matches = (
                issue_category in PERFORMANCE_ISSUE_CATEGORIES
                or issue_category == GroupCategory.PERFORMANCE
            )
        else:
            category_matches = value == issue_category

        return bool(category_matches if include else not category_matches)

    @classmethod
    def render_label(cls, condition_data: dict[str, Any], organization_id: int) -> str:
        value = condition_data["value"]
        title = CATEGORY_CHOICES.get(value)
        group_category_name = title.title() if title else ""
        include_label = INCLUDE_CHOICES.get(condition_data.get("include", "true"), "equal to")
        return cls.label_template.format(include=include_label, value=group_category_name)
