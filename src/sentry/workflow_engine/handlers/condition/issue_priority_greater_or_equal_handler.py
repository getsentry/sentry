from typing import Any

from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL)
class IssuePriorityGreaterOrEqualConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        if not isinstance(event_data.event, GroupEvent):
            # If the event is not a GroupEvent, we cannot evaluate priority
            return False

        group = event_data.event.group
        return group.priority >= comparison
