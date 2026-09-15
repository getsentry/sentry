from typing import Any

from django.db.models import Max

from sentry.incidents.grouptype import MetricIssue
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.groupopenperiod import get_latest_open_period, should_create_open_periods
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity
from sentry.notifications.utils.open_period import get_open_period_for_event
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.evaluations import DataConditionEvaluationException
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_PRIORITY_DEESCALATING)
class IssuePriorityDeescalatingConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES
    comparison_json_schema = {"type": "integer", "enum": [*PriorityLevel]}

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group

        # This condition only works for issue types that create open periods (which excludes errors).
        if not should_create_open_periods(group.type):
            return False

        # we will fire actions on de-escalation if the priority seen is >= the threshold
        # priority specified in the comparison
        current_priority = group.priority
        is_metric_resolution = (
            group.type == MetricIssue.type_id
            and isinstance(event_data.event, Activity)
            and event_data.event.type == ActivityType.SET_RESOLVED.value
        )
        is_resolved = is_metric_resolution or group.status == GroupStatus.RESOLVED
        open_period = (
            get_open_period_for_event(group, event_data.event)
            if is_metric_resolution
            else get_latest_open_period(group)
        )
        if open_period is None:
            raise DataConditionEvaluationException("No open period found")

        # Existing rows may still contain the automation builder's previous boolean default.
        # Keep evaluation compatible until those rows are migrated to a priority threshold.
        if comparison is True:
            return is_resolved

        highest_seen_priority = open_period.data.get("highest_seen_priority")
        if highest_seen_priority is None and is_metric_resolution:
            # Regressions at the same priority may only have an OPENED activity,
            # without highest_seen_priority in the period's data.
            highest_seen_priority = GroupOpenPeriodActivity.objects.filter(
                group_open_period=open_period
            ).aggregate(priority=Max("value"))["priority"]
            if highest_seen_priority is None:
                raise DataConditionEvaluationException("No priority history found for open period")
        elif highest_seen_priority is None:
            highest_seen_priority = current_priority

        return comparison <= highest_seen_priority and (
            current_priority < comparison or is_resolved
        )
