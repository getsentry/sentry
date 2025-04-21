from typing import Any

from sentry.models.group import GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_PRIORITY_DEESCALATING)
class IssuePriorityDeescalatingConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.event.group
        if group.status == GroupStatus.RESOLVED:
            return True

        current_priority = group.priority
        open_period = GroupOpenPeriod.objects.filter(group=group).order_by("-date_started").first()
        if open_period is None:
            raise Exception("No open period found")
        highest_seen_priority = open_period.data.get("highest_seen_priority", current_priority)

        return current_priority < highest_seen_priority
