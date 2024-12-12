from typing import Any

from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, DetectorPriorityLevel


def get_nested_value(data: Any, path: str, default: Any = None) -> Any | None:
    try:
        value = data
        for part in path.split("."):
            if hasattr(value, part):
                value = getattr(value, part)
            elif hasattr(value, "get"):
                value = value.get(part)
            else:
                return default
        return value
    except Exception:
        return default


@condition_handler_registry.register(Condition.GROUP_EVENT_ATTR_COMPARISON)
class GroupEventConditionHandler(DataConditionHandler[GroupEvent]):
    @staticmethod
    def evaluate_value(
        value: GroupEvent, comparison: Any, condition: str, **kwargs: Any
    ) -> DetectorPriorityLevel | int | float | bool | None:
        # conditions stores the path to the attribute in the event
        event_value = get_nested_value(value, condition)
        if event_value is None:
            event_value = get_nested_value(
                kwargs, condition
            )  # TODO: remove when GroupEvent contains EventState

        return event_value == comparison
