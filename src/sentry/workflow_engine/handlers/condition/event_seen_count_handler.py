from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import UnsupportedPreviewBehavior
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import ActionFilterDataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.EVENT_SEEN_COUNT)
class EventSeenCountConditionHandler(ActionFilterDataConditionHandler[WorkflowEventData]):
    preview_behavior = UnsupportedPreviewBehavior("Event counts require event data")
    comparison_json_schema = {"type": "integer", "minimum": 1}

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group
        return group.times_seen == comparison
