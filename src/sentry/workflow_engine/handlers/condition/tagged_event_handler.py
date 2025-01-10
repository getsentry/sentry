from typing import Any

from sentry import tagstore
from sentry.rules import MatchType, match_values
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, DataConditionHandlerType, WorkflowJob


@condition_handler_registry.register(Condition.TAGGED_EVENT)
class TaggedEventConditionHandler(DataConditionHandler[WorkflowJob]):
    type: DataConditionHandlerType = DataConditionHandlerType.ACTION_FILTER

    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        event = job["event"]
        raw_tags = event.tags
        key = comparison.get("key")
        match = comparison.get("match")
        value = comparison.get("value")

        if not key or not match:
            return False

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

        if not value:
            return False

        value = value.lower()

        # This represents the fetched tag values given the provided key
        # so eg. if the key is 'environment' and the tag_value is 'production'
        tag_values = (
            v.lower()
            for k, v in raw_tags
            if k.lower() == key or tagstore.backend.get_standardized_key(k) == key
        )

        return match_values(group_values=tag_values, match_value=value, match_type=match)
