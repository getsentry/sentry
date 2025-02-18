from typing import Any

from sentry.rules.conditions.event_frequency import (
    COMPARISON_INTERVALS,
    STANDARD_INTERVALS,
    percent_increase,
)
from sentry.workflow_engine.handlers.condition.tagged_event_handler import (
    TaggedEventConditionHandler,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, DataConditionResult


@condition_handler_registry.register(Condition.EVENT_FREQUENCY_COUNT)
@condition_handler_registry.register(Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT)
class EventFrequencyCountHandler(DataConditionHandler[list[int]]):
    comparison_json_schema = {
        "type": "object",
        "properties": {
            "interval": {"type": "string", "enum": list(STANDARD_INTERVALS.keys())},
            "value": {"type": "integer", "minimum": 0},
            "filters": {
                "type": "array",
                "items": TaggedEventConditionHandler.comparison_json_schema,
            },
        },
        "required": ["interval", "value"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(value: list[int], comparison: Any) -> DataConditionResult:
        if not isinstance(value, list) or len(value) != 1:
            return False
        return value[0] > comparison["value"]


@condition_handler_registry.register(Condition.EVENT_FREQUENCY_PERCENT)
@condition_handler_registry.register(Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT)
class EventFrequencyPercentHandler(DataConditionHandler[list[int]]):
    comparison_json_schema = {
        "type": "object",
        "properties": {
            "interval": {"type": "string", "enum": list(STANDARD_INTERVALS.keys())},
            "value": {"type": "integer", "minimum": 0},
            "comparison_interval": {"type": "string", "enum": list(COMPARISON_INTERVALS.keys())},
            "filters": {
                "type": "array",
                "items": TaggedEventConditionHandler.comparison_json_schema,
            },
        },
        "required": ["interval", "value", "comparison_interval"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(value: list[int], comparison: Any) -> DataConditionResult:
        if not isinstance(value, list) or len(value) != 2:
            return False
        return percent_increase(value[0], value[1]) > comparison["value"]


# Percent sessions values must be between 0-100 (%)
@condition_handler_registry.register(Condition.PERCENT_SESSIONS_COUNT)
class PercentSessionsCountHandler(EventFrequencyCountHandler):
    comparison_json_schema = {
        "type": "object",
        "properties": {
            "interval": {"type": "string", "enum": list(STANDARD_INTERVALS.keys())},
            "value": {"type": "number", "minimum": 0, "maximum": 100},
            "filters": {
                "type": "array",
                "items": TaggedEventConditionHandler.comparison_json_schema,
            },
        },
        "required": ["interval", "value"],
        "additionalProperties": False,
    }


@condition_handler_registry.register(Condition.PERCENT_SESSIONS_PERCENT)
class PercentSessionsPercentHandler(EventFrequencyPercentHandler):
    comparison_json_schema = {
        "type": "object",
        "properties": {
            "interval": {"type": "string", "enum": list(STANDARD_INTERVALS.keys())},
            "value": {"type": "number", "minimum": 0, "maximum": 100},
            "comparison_interval": {"type": "string", "enum": list(COMPARISON_INTERVALS.keys())},
            "filters": {
                "type": "array",
                "items": TaggedEventConditionHandler.comparison_json_schema,
            },
        },
        "required": ["interval", "value", "comparison_interval"],
        "additionalProperties": False,
    }
