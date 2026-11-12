from typing import Any

from django.db.models import Q

from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.condition.first_seen_event_handler import is_new_event
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import AlertPreviewPlan, WorkflowTriggerPreviewBehavior
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


class NewHighPriorityIssuePreviewBehavior(WorkflowTriggerPreviewBehavior):
    def add_to_preview(self, plan: AlertPreviewPlan, _comparison: Any) -> None:
        plan.add_group_candidates(Q(priority=PriorityLevel.HIGH))


@condition_handler_registry.register(Condition.NEW_HIGH_PRIORITY_ISSUE)
class NewHighPriorityIssueConditionHandler(WorkflowTriggerDataConditionHandler):
    preview_behavior = NewHighPriorityIssuePreviewBehavior()
    comparison_json_schema = {"type": "boolean"}
    label_template = "Sentry marks a new issue as high priority"

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        is_new = is_new_event(event_data)
        return is_new and event_data.group.priority == PriorityLevel.HIGH
