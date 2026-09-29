from typing import Any

from django.db.models import Q

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import AlertPreviewPlan, WorkflowTriggerPreviewBehavior
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


def is_new_event(event_data: WorkflowEventData) -> bool:
    state = event_data.group_state
    if state is None:
        return False

    if event_data.workflow_env is None:
        return state["is_new"]

    return state["is_new_group_environment"]


class FirstSeenPreviewBehavior(WorkflowTriggerPreviewBehavior):
    def add_to_preview(self, plan: AlertPreviewPlan, _comparison: Any) -> None:
        plan.add_group_candidates(Q())


@condition_handler_registry.register(Condition.FIRST_SEEN_EVENT)
class FirstSeenEventConditionHandler(WorkflowTriggerDataConditionHandler):
    preview_behavior = FirstSeenPreviewBehavior()
    comparison_json_schema = {"type": "boolean"}
    label_template = "A new issue is created"

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        return is_new_event(event_data)
