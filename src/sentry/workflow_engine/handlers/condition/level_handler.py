from typing import Any, Callable

from sentry.constants import LOG_LEVELS, LOG_LEVELS_MAP
from sentry.rules import LEVEL_MATCH_CHOICES, MatchType
from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData

key: Callable[[tuple[int, str]], int] = lambda x: x[0]
LEVEL_CHOICES = {f"{k}": v for k, v in sorted(LOG_LEVELS.items(), key=key, reverse=True)}


@condition_handler_registry.register(Condition.LEVEL)
class LevelConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.EVENT_ATTRIBUTES
    label_template = "The event's level is {match} {level}"

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "level": {"type": "integer", "enum": list(LOG_LEVELS_MAP.values())},
            "match": {"type": "string", "enum": [*MatchType]},
        },
        "required": ["level", "match"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        event = event_data.event

        if not isinstance(event, GroupEvent):
            # This condition is only applicable to GroupEvent
            return False

        level_name = event.get_tag("level")
        if level_name is None:
            return False

        desired_level = int(comparison.get("level"))
        desired_match = comparison.get("match")

        # Fetch the event level from the tags since event.level is
        # event.group.level which may have changed
        try:
            level: int = LOG_LEVELS_MAP[level_name]
        except KeyError:
            return False

        if desired_match == MatchType.EQUAL:
            return level == desired_level
        elif desired_match == MatchType.GREATER_OR_EQUAL:
            return level >= desired_level
        elif desired_match == MatchType.LESS_OR_EQUAL:
            return level <= desired_level
        return False

    @classmethod
    def render_label(cls, condition_data: dict[str, Any]) -> str:
        data = {
            "level": LEVEL_CHOICES[condition_data["level"]],
            "match": LEVEL_MATCH_CHOICES[condition_data["match"]],
        }
        return cls.label_template.format(**data)
