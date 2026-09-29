from typing import Any

from django.db.models import Q

from sentry.issues.action_log.types import SetPriorityAction
from sentry.issues.priority import PriorityChangeReason
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import AlertPreviewPlan, WorkflowTriggerPreviewBehavior
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


class ExistingHighPriorityIssuePreviewBehavior(WorkflowTriggerPreviewBehavior):
    def add_to_preview(self, plan: AlertPreviewPlan, _comparison: Any) -> None:
        plan.add_group_action_log_candidates(
            Q(
                type=SetPriorityAction.get_type().value,
                data__priority=PriorityLevel.HIGH.to_str(),
                data__reason=PriorityChangeReason.ESCALATING.value,
            )
        )


@condition_handler_registry.register(Condition.EXISTING_HIGH_PRIORITY_ISSUE)
class ExistingHighPriorityIssueConditionHandler(WorkflowTriggerDataConditionHandler):
    preview_behavior = ExistingHighPriorityIssuePreviewBehavior()
    comparison_json_schema = {"type": "boolean"}
    label_template = "Sentry marks an existing issue as high priority"

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        state = event_data.group_state
        if state is None or state["is_new"]:
            return False

        return bool(event_data.has_escalated) and event_data.group.priority == PriorityLevel.HIGH
