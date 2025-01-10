from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, DataConditionHandlerType, WorkflowJob


@condition_handler_registry.register(Condition.EVERY_EVENT)
class EveryEventConditionHandler(DataConditionHandler[WorkflowJob]):
    type: DataConditionHandlerType = DataConditionHandlerType.WORKFLOW_TRIGGER

    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        return True
