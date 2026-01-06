from typing import Any

from sentry.tasks.post_process import fetch_buffered_group_stats
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_OCCURRENCES)
class IssueOccurrencesConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "value": {"type": "integer", "minimum": 0},
        },
        "required": ["value"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        try:
            value = int(comparison["value"])
        except (TypeError, ValueError, KeyError):
            return False

        # This value is slightly delayed due to us batching writes to times_seen. We attempt to work
        # around this by including pending updates from buffers to improve accuracy.
        group = event_data.group
        fetch_buffered_group_stats(event_data.group)
        issue_occurrences = (
            group.times_seen_with_pending
            if hasattr(group, "times_seen_pending")
            else group.times_seen
        )

        return bool(issue_occurrences >= value)
