from typing import Any

from sentry import tagstore
from sentry.rules import MatchType, match_values
from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData
from sentry.workflow_engine.utils import log_context

logger = log_context.get_logger(__name__)


@condition_handler_registry.register(Condition.TAGGED_EVENT)
class TaggedEventConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.EVENT_ATTRIBUTES

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "key": {"type": "string"},
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
                    "key": {"type": "string"},
                    "match": {"enum": [MatchType.IS_SET, MatchType.NOT_SET]},
                },
                "required": ["key", "match"],
                "not": {"required": ["value"]},
            },
            {
                "properties": {
                    "key": {"type": "string"},
                    "match": {
                        "not": {"enum": [MatchType.IS_SET, MatchType.NOT_SET]},
                    },
                    "value": {"type": "string"},
                },
                "required": ["key", "match", "value"],
            },
        ],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        event = event_data.event

        if not isinstance(event, GroupEvent):
            # We can only evaluate tagged events for GroupEvent types
            return False

        raw_tags = event.tags
        key = comparison["key"]
        match = comparison["match"]

        key = key.lower()

        tag_keys = (
            k
            for gen in (
                (k.lower() for k, v in raw_tags),
                (tagstore.backend.get_standardized_key(k) for k, v in raw_tags),
            )
            for k in gen
        )

        # NOTE: IS_SET condition differs btw tagged_event and event_attribute so not handled by match_values
        # For tagged_event we need to check that the key exists in the list of all tag_keys
        if match == MatchType.IS_SET:
            return key in tag_keys
        elif match == MatchType.NOT_SET:
            return key not in tag_keys

        value = comparison["value"]
        value = value.lower()

        # This represents the fetched tag values given the provided key
        # so eg. if the key is 'environment' and the tag_value is 'production'
        tag_values = (
            v.lower()
            for k, v in raw_tags
            if k.lower() == key or tagstore.backend.get_standardized_key(k) == key
        )

        result = match_values(group_values=tag_values, match_value=value, match_type=match)

        logger.debug(
            "workflow_engine.handlers.tagged_event_handler",
            extra={
                "evaluation_result": result,
                "event": event,
                "event_tags": event.tags,
                "processed_values": tag_values,
                "comparison_type": match,
            },
        )

        return result
