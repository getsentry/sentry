from typing import Any

from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry


def get_nested_value(data: GroupEvent, path: str, default: Any = None) -> Any | None:
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


@condition_handler_registry.register(Condition.EVENT_COMPARISON)
def event_comparison_operator(data: GroupEvent, comparison: Any, condition: str) -> bool:
    event_value = get_nested_value(data, condition)
    if event_value == comparison:
        return True

    return False
