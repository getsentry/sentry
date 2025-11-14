from typing import int, Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


def is_new_event(event_data: WorkflowEventData) -> bool:
    state = event_data.group_state
    if state is None:
        return False

    if event_data.workflow_env is None:
        return state["is_new"]

    return state["is_new_group_environment"]


@condition_handler_registry.register(Condition.FIRST_SEEN_EVENT)
class FirstSeenEventConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.WORKFLOW_TRIGGER
    comparison_json_schema = {"type": "boolean"}

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        return is_new_event(event_data)
