from typing import Any

from django.db.models import Exists, OuterRef, Q, Subquery

from sentry.models.group import GroupStatus
from sentry.models.groupopenperiod import (
    GroupOpenPeriod,
    get_group_types_without_open_periods,
    get_latest_open_period,
    should_create_open_periods,
)
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import (
    ActionFilterPreviewBehavior,
    ActionFilterPreviewPlan,
    InvalidPreviewConfiguration,
)
from sentry.workflow_engine.processors.evaluations import DataConditionEvaluationException
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import (
    ActionFilterDataConditionHandler,
    DataConditionHandler,
    WorkflowEventData,
)


class IssuePriorityDeescalatingPreviewBehavior(ActionFilterPreviewBehavior):
    def filter_preview(self, plan: ActionFilterPreviewPlan, comparison: Any) -> None:
        excluded_group_types = get_group_types_without_open_periods()
        latest_open_period_id = (
            GroupOpenPeriod.objects.filter(group_id=OuterRef("group_id"))
            .order_by("-date_started")
            .values("id")[:1]
        )
        latest_open_periods = GroupOpenPeriod.objects.filter(
            group_id=OuterRef("pk"),
            id=Subquery(latest_open_period_id),
        )

        # Existing rows may still contain the automation builder's previous boolean default.
        if comparison is True:
            plan.add_group_filter(
                ~Q(type__in=excluded_group_types)
                & Q(Exists(latest_open_periods), status=GroupStatus.RESOLVED)
            )
            return

        try:
            priority = PriorityLevel(comparison)
        except (TypeError, ValueError) as error:
            raise InvalidPreviewConfiguration("Invalid issue priority") from error

        latest_open_periods = latest_open_periods.filter(
            Q(data__highest_seen_priority__gte=priority)
            | Q(data__highest_seen_priority__isnull=True, group__priority__gte=priority)
        )
        plan.add_group_filter(
            ~Q(type__in=excluded_group_types)
            & Q(Exists(latest_open_periods))
            & (Q(priority__lt=priority) | Q(status=GroupStatus.RESOLVED))
        )


@condition_handler_registry.register(Condition.ISSUE_PRIORITY_DEESCALATING)
class IssuePriorityDeescalatingConditionHandler(
    ActionFilterDataConditionHandler[WorkflowEventData]
):
    preview_behavior = IssuePriorityDeescalatingPreviewBehavior()
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
        open_period = get_latest_open_period(group)
        if open_period is None:
            raise DataConditionEvaluationException("No open period found")
        # use this to determine if we've breached the comparison priority before
        highest_seen_priority = open_period.data.get("highest_seen_priority", current_priority)

        # Existing rows may still contain the automation builder's previous boolean default.
        # Keep evaluation compatible until those rows are migrated to a priority threshold.
        if comparison is True:
            return group.status == GroupStatus.RESOLVED

        return comparison <= highest_seen_priority and (
            current_priority < comparison or group.status == GroupStatus.RESOLVED
        )
