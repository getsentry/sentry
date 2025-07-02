from typing import Any

import sentry_sdk

from sentry.eventstore.models import GroupEvent
from sentry.rules import MatchType, match_values
from sentry.rules.conditions.event_attribute import ATTR_CHOICES, attribute_registry
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.EVENT_ATTRIBUTE)
class EventAttributeConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.EVENT_ATTRIBUTES

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "attribute": {"type": "string", "enum": list(ATTR_CHOICES.keys())},
            "match": {
                "type": "string",
                "enum": [*MatchType],
            },
            "value": {
                "type": "string",
                "optional": True,
            },
        },
        "oneOf": [
            {
                "properties": {
                    "attribute": {"type": "string", "enum": list(ATTR_CHOICES.keys())},
                    "match": {"enum": [MatchType.IS_SET, MatchType.NOT_SET]},
                },
                "required": ["attribute", "match"],
                "not": {"required": ["value"]},
            },
            {
                "properties": {
                    "attribute": {"type": "string", "enum": list(ATTR_CHOICES.keys())},
                    "match": {
                        "not": {"enum": [MatchType.IS_SET, MatchType.NOT_SET]},
                    },
                    "value": {"type": "string"},
                },
                "required": ["attribute", "match", "value"],
            },
        ],
        "additionalProperties": False,
    }

    @staticmethod
    def get_attribute_values(event: GroupEvent, attribute: str) -> list[str]:
        path = attribute.split(".")
        first_attribute = path[0]
        try:
            attribute_handler = attribute_registry.get(first_attribute)
        except NoRegistrationExistsError:
            attribute_handler = None

        if not attribute_handler:
            attribute_values = []
        else:
            try:
                attribute_values = attribute_handler.handle(path, event)
            except KeyError as e:
                attribute_values = []
                sentry_sdk.capture_exception(e)

        attribute_values = [str(value).lower() for value in attribute_values if value is not None]

        return attribute_values

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        event = event_data.event
        if not isinstance(event, GroupEvent):
            # cannot evaluate event attributes on non-GroupEvent types
            return False

        attribute = comparison.get("attribute", "")
        attribute_values = EventAttributeConditionHandler.get_attribute_values(event, attribute)

        match = comparison.get("match")
        desired_value = comparison.get("value")
        if not (match and desired_value) and not (match in (MatchType.IS_SET, MatchType.NOT_SET)):
            return False

        desired_value = str(desired_value).lower()

        # NOTE: IS_SET condition differs btw tagged_event and event_attribute so not handled by match_values
        # For event_attribute we need to check that the value of the attribute is not None
        if match == MatchType.IS_SET:
            return bool(attribute_values)
        elif match == MatchType.NOT_SET:
            return not attribute_values

        return match_values(
            group_values=attribute_values, match_value=desired_value, match_type=match
        )
