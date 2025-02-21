from typing import Any

from sentry.models.group import Group
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


@condition_handler_registry.register(Condition.ISSUE_OCCURRENCES)
class IssueOccurrencesConditionHandler(DataConditionHandler[WorkflowJob]):
    type = [DataConditionHandler.Type.ACTION_FILTER]

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "value": {"type": "integer", "minimum": 0},
        },
        "required": ["value"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        group: Group = job["event"].group
        try:
            value = int(comparison["value"])
        except (TypeError, ValueError, KeyError):
            return False

        # This value is slightly delayed due to us batching writes to times_seen. We attempt to work
        # around this by including pending updates from buffers to improve accuracy.
        issue_occurrences: int = group.times_seen_with_pending
        return bool(issue_occurrences >= value)
