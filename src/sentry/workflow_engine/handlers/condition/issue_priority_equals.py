from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


@condition_handler_registry.register(Condition.ISSUE_PRIORITY_EQUALS)
class IssuePriorityCondition(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        group = job["event"].group
        return group.priority == comparison
