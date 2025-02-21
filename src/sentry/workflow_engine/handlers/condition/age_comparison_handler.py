from typing import Any

from django.utils import timezone

from sentry.rules.age import AgeComparisonType, age_comparison_map
from sentry.rules.filters.age_comparison import timeranges
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


@condition_handler_registry.register(Condition.AGE_COMPARISON)
class AgeComparisonConditionHandler(DataConditionHandler[WorkflowJob]):
    type = [DataConditionHandler.Type.ACTION_FILTER]

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
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        event = job["event"]
        first_seen = event.group.first_seen
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
