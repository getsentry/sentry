from typing import Any

from django.db.models import Q

from sentry.issues.action_log.types import SetEscalatingAction
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import AlertPreviewPlan, WorkflowTriggerPreviewBehavior
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


class ReappearedPreviewBehavior(WorkflowTriggerPreviewBehavior):
    def add_to_preview(self, plan: AlertPreviewPlan, _comparison: Any) -> None:
        plan.add_group_action_log_candidates(Q(type=SetEscalatingAction.get_type().value))


@condition_handler_registry.register(Condition.REAPPEARED_EVENT)
class ReappearedEventConditionHandler(WorkflowTriggerDataConditionHandler):
    preview_behavior = ReappearedPreviewBehavior()
    comparison_json_schema = {"type": "boolean"}
    label_template = "An issue escalates"

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        has_escalated = event_data.has_escalated
        if has_escalated is None:
            return False

        return has_escalated == comparison
