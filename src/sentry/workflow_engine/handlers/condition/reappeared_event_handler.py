from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


@condition_handler_registry.register(Condition.REAPPEARED_EVENT)
class ReappearedEventConditionHandler(DataConditionHandler[WorkflowJob]):
    type = [DataConditionHandler.Type.WORKFLOW_TRIGGER]
    comparison_json_schema = {"type": "boolean"}

    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        has_reappeared = job.get("has_reappeared")
        if has_reappeared is None:
            return False

        return has_reappeared == comparison
