from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, DataConditionHandlerType, WorkflowJob


@condition_handler_registry.register(Condition.EVENT_SEEN_COUNT)
class EventSeenCountConditionHandler(DataConditionHandler[WorkflowJob]):
    type: DataConditionHandlerType = DataConditionHandlerType.ACTION_FILTER

    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        event = job["event"]
        return event.group.times_seen == comparison
