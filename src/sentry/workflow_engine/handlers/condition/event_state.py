from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler

from .group_event import get_nested_value


@condition_handler_registry.register(Condition.EVENT_STATE_COMPARISON)
class EventStateConditionHandler(DataConditionHandler[dict[str, Any]]):
    @staticmethod
    def evaluate_value(data: dict[str, Any], comparison: Any, data_filter: str) -> bool:
        event_value = get_nested_value(data, data_filter)
        return event_value == comparison

    @staticmethod
    def get_expected_value(value: Any, **kwargs) -> Any:
        return kwargs
