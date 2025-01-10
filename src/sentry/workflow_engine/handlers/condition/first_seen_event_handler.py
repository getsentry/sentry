from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, DataConditionHandlerType, WorkflowJob


def is_new_event(job: WorkflowJob) -> bool:
    state = job.get("group_state")
    if state is None:
        return False

    workflow = job.get("workflow")
    if workflow is None or workflow.environment_id is None:
        return state["is_new"]

    return state["is_new_group_environment"]


@condition_handler_registry.register(Condition.FIRST_SEEN_EVENT)
class FirstSeenEventConditionHandler(DataConditionHandler[WorkflowJob]):
    type: DataConditionHandlerType = DataConditionHandlerType.WORKFLOW_TRIGGER

    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        return is_new_event(job)
