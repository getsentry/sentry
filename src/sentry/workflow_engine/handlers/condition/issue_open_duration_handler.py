from datetime import timedelta
from typing import Any

from django.utils import timezone

from sentry.models.groupopenperiod import get_latest_open_period
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


class IssueOpenDurationConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "comparison": {
                "type": "string",
                "enum": ["older", "younger"],
            },
            "value": {"type": "integer", "minimum": 0},
            "unit": {"type": "string", "enum": ["minutes", "hours", "days"]},
        },
        "required": ["comparison", "value", "unit"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group
        latest_open_period = get_latest_open_period(group)
        if not latest_open_period:
            return False

        value = int(comparison["value"])
        time_unit = comparison["unit"]

        # convert to minutes
        if time_unit == "hours":
            value = value * 60
        elif time_unit == "days":
            value = value * 60 * 24

        comparison_timestamp = timezone.now() - timedelta(minutes=value)

        if comparison["comparison"] == "older":
            return latest_open_period.date_started < comparison_timestamp
        return latest_open_period.date_started > comparison_timestamp
