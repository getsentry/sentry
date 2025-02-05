from typing import Any

from sentry.rules.conditions.event_frequency import (
    COMPARISON_INTERVALS,
    STANDARD_INTERVALS,
    percent_increase,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, DataConditionResult, WorkflowJob


@condition_handler_registry.register(Condition.EVENT_FREQUENCY_COUNT)
@condition_handler_registry.register(Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT)
class EventFrequencyCountHandler(DataConditionHandler[WorkflowJob]):
    comparison_json_schema = {
        "type": "object",
        "properties": {
            "interval": {"type": "string", "enum": list(STANDARD_INTERVALS.keys())},
            "value": {"type": "integer", "minimum": 0},
        },
        "required": ["interval", "value"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(value: WorkflowJob, comparison: Any) -> DataConditionResult:
        if len(value.get("snuba_results", [])) != 1:
            return False
        return value["snuba_results"][0] > comparison["value"]


@condition_handler_registry.register(Condition.EVENT_FREQUENCY_PERCENT)
@condition_handler_registry.register(Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT)
class EventFrequencyPercentHandler(DataConditionHandler[WorkflowJob]):
    comparison_json_schema = {
        "type": "object",
        "properties": {
            "interval": {"type": "string", "enum": list(STANDARD_INTERVALS.keys())},
            "value": {"type": "integer", "minimum": 0},
            "comparison_interval": {"type": "string", "enum": list(COMPARISON_INTERVALS.keys())},
        },
        "required": ["interval", "value", "comparison_interval"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(value: WorkflowJob, comparison: Any) -> DataConditionResult:
        if len(value.get("snuba_results", [])) != 2:
            return False
        return (
            percent_increase(value["snuba_results"][0], value["snuba_results"][1])
            > comparison["value"]
        )
