from typing import Any

from sentry.models.group import GroupStatus
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_PRIORITY_DEESCALATING)
class IssuePriorityDeescalatingConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "priority": {"type": "integer", "minimum": 0},
        },
        "required": ["priority"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.event.group

        # we will fire actions on de-escalation if the priority seen is >= the threshold
        # priority specified in the comparison
        comparison_priority = comparison.get("priority")
        current_priority = group.priority
        open_period = get_latest_open_period(group)
        if open_period is None:
            raise Exception("No open period found")
        # use this to determine if we've breached the comparison priority before
        highest_seen_priority = open_period.data.get("highest_seen_priority", current_priority)

        return comparison_priority <= highest_seen_priority and (
            current_priority < comparison_priority or group.status == GroupStatus.RESOLVED
        )
