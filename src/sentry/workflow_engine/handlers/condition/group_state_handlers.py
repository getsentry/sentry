from typing import Any

from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


def is_new_event(job: WorkflowJob) -> bool:
    state = job.get("group_state")
    if state is None:
        return False

    workflow = job.get("workflow")
    if workflow is None or workflow.environment_id is None:
        return state["is_new"]

    return state["is_new_group_environment"]


@condition_handler_registry.register(Condition.REGRESSION_EVENT)
class RegressionEventConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        state = job.get("group_state")
        if state is None:
            return False

        return state["is_regression"] == comparison


@condition_handler_registry.register(Condition.REAPPEARED_EVENT)
class ReappearedEventConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        has_reappeared = job.get("has_reappeared")
        if has_reappeared is None:
            return False

        return has_reappeared == comparison


@condition_handler_registry.register(Condition.EXISTING_HIGH_PRIORITY_ISSUE)
class ExistingHighPriorityIssueConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        state = job.get("group_state")
        if state is None or state["is_new"]:
            return False

        has_reappeared = job.get("has_reappeared", False)
        has_escalated = job.get("has_escalated", False)
        is_escalating = has_reappeared or has_escalated
        return is_escalating and job["event"].group.priority == PriorityLevel.HIGH


@condition_handler_registry.register(Condition.FIRST_SEEN_EVENT)
class FirstSeenEventConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        return is_new_event(job)


@condition_handler_registry.register(Condition.NEW_HIGH_PRIORITY_ISSUE)
class NewHighPriorityIssueConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        is_new = is_new_event(job)
        event = job["event"]
        if not event.project.flags.has_high_priority_alerts:
            return is_new

        return is_new and event.group.priority == PriorityLevel.HIGH
