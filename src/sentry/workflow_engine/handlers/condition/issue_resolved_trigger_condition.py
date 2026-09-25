from typing import Any

from django.db.models import Q

from sentry.issues.action_log.types import (
    ResolveAction,
    SetResolvedByAgeAction,
    SetResolvedInCommitAction,
    SetResolvedInReleaseAction,
)
from sentry.models.group import GroupStatus
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import AlertPreviewPlan, WorkflowTriggerPreviewBehavior
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


class IssueResolvedPreviewBehavior(WorkflowTriggerPreviewBehavior):
    def add_to_preview(self, plan: AlertPreviewPlan, _comparison: Any) -> None:
        plan.add_group_action_log_candidates(
            Q(
                type__in=[
                    ResolveAction.get_type().value,
                    SetResolvedInReleaseAction.get_type().value,
                    SetResolvedByAgeAction.get_type().value,
                    SetResolvedInCommitAction.get_type().value,
                ]
            )
        )


@condition_handler_registry.register(Condition.ISSUE_RESOLVED_TRIGGER)
class IssueResolvedTriggerCondition(WorkflowTriggerDataConditionHandler):
    preview_behavior = IssueResolvedPreviewBehavior()
    comparison_json_schema = {"type": "boolean"}

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, _: Any) -> bool:
        group = event_data.group
        return group.status == GroupStatus.RESOLVED
