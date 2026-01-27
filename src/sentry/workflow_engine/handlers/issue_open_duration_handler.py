from datetime import timedelta, timezone
from typing import Any

from sentry.models.groupopenperiod import get_latest_open_period
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


class IssueOpenDurationConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES

    # need older/younger, amount of time, time scale(?)
    # let's deal with time scale later
    comparison_json_schema = {
        "type": "object",
        "properties": {
            "comparison": {
                "type": "string",
                "enum": ["older", "younger"],
            },  # we should make these an enum I think
            "value": {"type": "integer", "minimum": 0},
        },
        "required": ["comparison", "value"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group
        latest_open_period = get_latest_open_period(group)
        if not latest_open_period:
            return False

        comparison_timestamp = timezone.now() - timedelta(minutes=int(comparison["value"]))

        if comparison["comparison"] == "older":
            return latest_open_period.date_started < comparison_timestamp
        return latest_open_period.date_started > comparison_timestamp
