from typing import Any

from django.utils import timezone

from sentry.models.groupopenperiod import get_latest_open_period
from sentry.rules.age import AgeComparisonType, age_comparison_map
from sentry.rules.filters.age_comparison import timeranges
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_OPEN_DURATION)
class IssueOpenDurationConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES

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
        latest_open_period = get_latest_open_period(group)
        if not latest_open_period:
            return False

        comparison_type = comparison["comparison_type"]
        time = comparison["time"]
        value = int(comparison["value"])
        _, delta_time = timeranges[time]

        current_time = timezone.now()

        passes: bool = age_comparison_map[comparison_type](
            latest_open_period.date_started + (value * delta_time), current_time
        )
        return passes
