from typing import Any

from django.db.models import Q
from django.utils import timezone

from sentry.rules.filters.age_comparison import timeranges
from sentry.workflow_engine.handlers.condition.utils.age import (
    AgeComparisonType,
    age_comparison_map,
)
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


class AgeComparisonPreviewBehavior(ActionFilterPreviewBehavior):
    def filter_preview(self, plan: ActionFilterPreviewPlan, comparison: Any) -> None:
        try:
            comparison_type = AgeComparisonType(comparison["comparison_type"])
            value = int(comparison["value"])
            _, delta_time = timeranges[comparison["time"]]
        except (KeyError, TypeError, ValueError) as error:
            raise InvalidPreviewConfiguration("Invalid issue age comparison") from error

        cutoff = timezone.now() - (value * delta_time)
        lookup = (
            "first_seen__lt" if comparison_type == AgeComparisonType.OLDER else "first_seen__gt"
        )
        plan.add_group_filter(Q(**{lookup: cutoff}))


@condition_handler_registry.register(Condition.AGE_COMPARISON)
class AgeComparisonConditionHandler(ActionFilterDataConditionHandler[WorkflowEventData]):
    preview_behavior = AgeComparisonPreviewBehavior()
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES
    label_template = "The issue is {comparison_type} than {value} {time}"

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "comparison_type": {
                "type": "string",
                "enum": [AgeComparisonType.OLDER, AgeComparisonType.NEWER],
            },
            "value": {"type": "integer", "minimum": 0},
            "time": {"type": "string", "enum": list(timeranges.keys())},
        },
        "required": ["comparison_type", "value", "time"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group
        first_seen = group.first_seen
        current_time = timezone.now()
        comparison_type = comparison["comparison_type"]
        time = comparison["time"]

        if (
            not comparison_type
            or not time
            or time not in timeranges
            or (
                comparison_type != AgeComparisonType.OLDER
                and comparison_type != AgeComparisonType.NEWER
            )
        ):
            return False

        try:
            value = int(comparison["value"])
        except (TypeError, ValueError):
            return False

        _, delta_time = timeranges[time]
        passes: bool = age_comparison_map[comparison_type](
            first_seen + (value * delta_time), current_time
        )
        return passes
