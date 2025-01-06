from typing import Any

import sentry_sdk

from sentry import tagstore
from sentry.constants import LOG_LEVELS_MAP
from sentry.eventstore.models import GroupEvent
from sentry.rules import MatchType, match_values
from sentry.rules.conditions.event_attribute import attribute_registry
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


@condition_handler_registry.register(Condition.EVENT_CREATED_BY_DETECTOR)
class EventCreatedByDetectorConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        event = job["event"]
        if event.occurrence is None or event.occurrence.evidence_data is None:
            return False

        return event.occurrence.evidence_data.get("detector_id", None) == comparison


@condition_handler_registry.register(Condition.EVERY_EVENT)
class EveryEventConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        return True


@condition_handler_registry.register(Condition.EVENT_SEEN_COUNT)
class EventSeenCountConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        event = job["event"]
        return event.group.times_seen == comparison


@condition_handler_registry.register(Condition.EVENT_ATTRIBUTE)
class EventAttributeConditionHandler(DataConditionHandler[WorkflowJob]):
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
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        event = job["event"]
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


@condition_handler_registry.register(Condition.LEVEL)
class LevelConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        event = job["event"]
        level_name = event.get_tag("level")
        if level_name is None:
            return False

        desired_level_raw = comparison.get("level")
        desired_match = comparison.get("match")

        if not desired_level_raw or not desired_match:
            return False

        desired_level = int(desired_level_raw)
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


@condition_handler_registry.register(Condition.TAGGED_EVENT)
class TaggedEventConditionHandler(DataConditionHandler[WorkflowJob]):
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
