from typing import Any

from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler


@condition_handler_registry.register(Condition.GROUP_EVENT_ATTR_COMPARISON)
class GroupEventConditionHandler(DataConditionHandler[GroupEvent]):
    @staticmethod
    def evaluate_value(data: GroupEvent, comparison: Any, data_filter: str) -> bool:
        return data.occurrence.evidence_data["detector_id"] == comparison
