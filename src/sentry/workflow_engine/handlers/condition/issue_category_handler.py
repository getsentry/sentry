from typing import Any

from sentry.issues.grouptype import GroupCategory
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


@condition_handler_registry.register(Condition.ISSUE_CATEGORY)
class IssueCategoryConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        group = job["event"].group

        try:
            value: GroupCategory = GroupCategory(int(comparison["value"]))
        except (TypeError, ValueError, KeyError):
            return False

        try:
            issue_category = group.issue_category
        except ValueError:
            return False

        return bool(value == issue_category)
