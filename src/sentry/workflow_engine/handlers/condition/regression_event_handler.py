from typing import Any

from django.db.models import Q

from sentry.issues.action_log.types import SetRegressedAction
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import AlertPreviewPlan, WorkflowTriggerPreviewBehavior
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


class RegressionPreviewBehavior(WorkflowTriggerPreviewBehavior):
    def add_to_preview(self, plan: AlertPreviewPlan, _comparison: Any) -> None:
        plan.add_group_action_log_candidates(Q(type=SetRegressedAction.get_type().value))


@condition_handler_registry.register(Condition.REGRESSION_EVENT)
class RegressionEventConditionHandler(WorkflowTriggerDataConditionHandler):
    preview_behavior = RegressionPreviewBehavior()
    comparison_json_schema = {"type": "boolean"}
    label_template = "The issue changes state from resolved to unresolved"

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        state = event_data.group_state
        if state is None:
            return False

        return state["is_regression"] == comparison
