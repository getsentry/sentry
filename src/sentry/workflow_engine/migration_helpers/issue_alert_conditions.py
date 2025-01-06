from collections.abc import Callable
from typing import Any

from sentry.rules.conditions.event_attribute import EventAttributeCondition
from sentry.rules.conditions.every_event import EveryEventCondition
from sentry.rules.conditions.existing_high_priority_issue import ExistingHighPriorityIssueCondition
from sentry.rules.conditions.first_seen_event import FirstSeenEventCondition
from sentry.rules.conditions.level import LevelCondition
from sentry.rules.conditions.new_high_priority_issue import NewHighPriorityIssueCondition
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.rules.conditions.tagged_event import TaggedEventCondition
from sentry.rules.filters.event_attribute import EventAttributeFilter
from sentry.rules.filters.level import LevelFilter
from sentry.rules.filters.tagged_event import TaggedEventFilter
from sentry.rules.match import MatchType
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup

data_condition_translator_registry = Registry[
    Callable[[dict[str, Any], DataConditionGroup], DataCondition]
](enable_reverse_lookup=False)


def translate_to_data_condition(data: dict[str, Any], dcg: DataConditionGroup):
    translator = data_condition_translator_registry.get(data["id"])
    return translator(data, dcg)


@data_condition_translator_registry.register(ReappearedEventCondition.id)
def create_reappeared_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition.objects.create(
        type=Condition.REAPPEARED_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(RegressionEventCondition.id)
def create_regressed_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition.objects.create(
        type=Condition.REGRESSION_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(EveryEventCondition.id)
def create_every_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition.objects.create(
        type=Condition.EVERY_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(ExistingHighPriorityIssueCondition.id)
def create_existing_high_priority_issue_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition.objects.create(
        type=Condition.EXISTING_HIGH_PRIORITY_ISSUE,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(EventAttributeCondition.id)
@data_condition_translator_registry.register(EventAttributeFilter.id)
def create_event_attribute_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    # TODO: Add comparison validation (error if not enough information)
    comparison = {
        "match": data["match"],
        "value": data["value"],
        "attribute": data["attribute"],
    }

    return DataCondition.objects.create(
        type=Condition.EVENT_ATTRIBUTE,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(FirstSeenEventCondition.id)
def create_first_seen_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition.objects.create(
        type=Condition.FIRST_SEEN_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(NewHighPriorityIssueCondition.id)
def create_new_high_priority_issue_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition.objects.create(
        type=Condition.NEW_HIGH_PRIORITY_ISSUE,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(LevelCondition.id)
@data_condition_translator_registry.register(LevelFilter.id)
def create_level_condition(data: dict[str, Any], dcg: DataConditionGroup) -> DataCondition:
    # TODO: Add comparison validation (error if not enough information)
    comparison = {"match": data["match"], "level": data["level"]}

    return DataCondition.objects.create(
        type=Condition.LEVEL,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(TaggedEventCondition.id)
@data_condition_translator_registry.register(TaggedEventFilter.id)
def create_tagged_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    # TODO: Add comparison validation (error if not enough information)
    comparison = {
        "match": data["match"],
        "key": data["key"],
    }
    if comparison["match"] not in {MatchType.IS_SET, MatchType.NOT_SET}:
        comparison["value"] = data["value"]

    return DataCondition.objects.create(
        type=Condition.TAGGED_EVENT,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )
