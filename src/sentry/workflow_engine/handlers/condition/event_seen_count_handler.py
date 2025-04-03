from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.EVENT_SEEN_COUNT)
class EventSeenCountConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        event = event_data.event
        return event.group.times_seen == comparison
