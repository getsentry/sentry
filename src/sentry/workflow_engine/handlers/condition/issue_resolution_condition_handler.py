from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ISSUE_RESOLUTION_CHANGE)
class IssueResolutionConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.WORKFLOW_TRIGGER

    @staticmethod
    def evaluate_value(job: WorkflowEventData, comparison: Any) -> bool:
        group = job.event.group
        return group.status == comparison
