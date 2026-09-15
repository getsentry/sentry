from typing import Any

from sentry.incidents.grouptype import MetricIssue
from sentry.models.activity import Activity
from sentry.services.eventstore.models import GroupEvent
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL)
class IssuePriorityGreaterOrEqualConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES
    comparison_json_schema = {
        "type": "integer",
        "enum": [*PriorityLevel],
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        # Some stored comparisons are priority strings instead of ints.
        # Tolerate until cleaned up (ISWF-3433).
        if isinstance(comparison, str):
            comparison = PriorityLevel.from_str(comparison)
            if comparison is None:
                return False

        group = event_data.group
        if group.type == MetricIssue.type_id:
            event = event_data.event
            if isinstance(event, Activity) and event.type == ActivityType.SET_RESOLVED.value:
                # Resolutions must match the de-escalation filter for their period,
                # not the priority of a subsequently reopened group.
                return False
            if isinstance(event, GroupEvent) and event.occurrence is not None:
                if event.occurrence.priority is not None:
                    return event.occurrence.priority >= comparison
        return group.priority >= comparison
