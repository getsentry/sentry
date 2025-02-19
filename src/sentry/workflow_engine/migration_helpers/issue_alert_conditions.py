from collections.abc import Callable
from typing import Any

from sentry.rules.conditions.event_attribute import EventAttributeCondition
from sentry.rules.conditions.event_frequency import (
    ComparisonType,
    EventFrequencyCondition,
    EventFrequencyPercentCondition,
    EventUniqueUserFrequencyCondition,
)
from sentry.rules.conditions.every_event import EveryEventCondition
from sentry.rules.conditions.existing_high_priority_issue import ExistingHighPriorityIssueCondition
from sentry.rules.conditions.first_seen_event import FirstSeenEventCondition
from sentry.rules.conditions.level import LevelCondition
from sentry.rules.conditions.new_high_priority_issue import NewHighPriorityIssueCondition
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.rules.conditions.tagged_event import TaggedEventCondition
from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.rules.filters.assigned_to import AssignedToFilter
from sentry.rules.filters.event_attribute import EventAttributeFilter
from sentry.rules.filters.issue_category import IssueCategoryFilter
from sentry.rules.filters.issue_occurrences import IssueOccurrencesFilter
from sentry.rules.filters.latest_adopted_release_filter import LatestAdoptedReleaseFilter
from sentry.rules.filters.latest_release import LatestReleaseFilter
from sentry.rules.filters.level import LevelFilter
from sentry.rules.filters.tagged_event import TaggedEventFilter
from sentry.rules.match import MatchType
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup

data_condition_translator_registry = Registry[
    Callable[[dict[str, Any], DataConditionGroup], DataCondition]
](enable_reverse_lookup=False)


def translate_to_data_condition(data: dict[str, Any], dcg: DataConditionGroup) -> DataCondition:
    translator = data_condition_translator_registry.get(data["id"])
    return translator(data, dcg)


@data_condition_translator_registry.register(EveryEventCondition.id)
def create_every_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition(
        type=Condition.EVERY_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(ReappearedEventCondition.id)
def create_reappeared_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition(
        type=Condition.REAPPEARED_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(RegressionEventCondition.id)
def create_regression_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition(
        type=Condition.REGRESSION_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(ExistingHighPriorityIssueCondition.id)
def create_existing_high_priority_issue_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition(
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
    comparison = {
        "match": data["match"],
        "value": data["value"],
        "attribute": data["attribute"],
    }

    return DataCondition(
        type=Condition.EVENT_ATTRIBUTE,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(FirstSeenEventCondition.id)
def create_first_seen_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition(
        type=Condition.FIRST_SEEN_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(NewHighPriorityIssueCondition.id)
def create_new_high_priority_issue_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition(
        type=Condition.NEW_HIGH_PRIORITY_ISSUE,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(LevelCondition.id)
@data_condition_translator_registry.register(LevelFilter.id)
def create_level_data_condition(data: dict[str, Any], dcg: DataConditionGroup) -> DataCondition:
    comparison = {"match": data["match"], "level": data["level"]}

    return DataCondition(
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
    comparison = {
        "match": data["match"],
        "key": data["key"],
    }
    if comparison["match"] not in {MatchType.IS_SET, MatchType.NOT_SET}:
        comparison["value"] = data["value"]

    return DataCondition(
        type=Condition.TAGGED_EVENT,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(AgeComparisonFilter.id)
def create_age_comparison_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    comparison = {
        "comparison_type": data["comparison_type"],
        "value": int(data["value"]),
        "time": data["time"],
    }

    return DataCondition(
        type=Condition.AGE_COMPARISON,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(AssignedToFilter.id)
def create_assigned_to_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    comparison = {
        "target_type": data["targetType"],
        "target_identifier": data["targetIdentifier"],
    }

    return DataCondition(
        type=Condition.ASSIGNED_TO,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(IssueCategoryFilter.id)
def create_issue_category_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    comparison = {
        "value": data["value"],
    }

    return DataCondition(
        type=Condition.ISSUE_CATEGORY,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(IssueOccurrencesFilter.id)
def create_issue_occurrences_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    comparison = {
        "value": data["value"],
    }

    return DataCondition(
        type=Condition.ISSUE_OCCURRENCES,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(LatestReleaseFilter.id)
def create_latest_release_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return DataCondition(
        type=Condition.LATEST_RELEASE,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(LatestAdoptedReleaseFilter.id)
def create_latest_adopted_release_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    comparison = {
        "release_age_type": data["oldest_or_newest"],
        "age_comparison": data["older_or_newer"],
        "environment": data["environment"],
    }
    return DataCondition(
        type=Condition.LATEST_ADOPTED_RELEASE,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


def create_base_event_frequency_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup, count_type: Condition, percent_type: Condition
) -> DataCondition:
    comparison_type = data["comparisonType"]  # this is camelCase, age comparison is snake_case
    comparison = {
        "interval": data["interval"],
        "value": data["value"],
    }

    if comparison_type == ComparisonType.COUNT:
        type = count_type
    else:
        type = percent_type
        comparison["comparison_interval"] = data["comparisonInterval"]

    return DataCondition(
        type=type,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


@data_condition_translator_registry.register(EventFrequencyCondition.id)
def create_event_frequency_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return create_base_event_frequency_data_condition(
        data=data,
        dcg=dcg,
        count_type=Condition.EVENT_FREQUENCY_COUNT,
        percent_type=Condition.EVENT_FREQUENCY_PERCENT,
    )


@data_condition_translator_registry.register(EventUniqueUserFrequencyCondition.id)
def create_event_unique_user_frequency_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return create_base_event_frequency_data_condition(
        data=data,
        dcg=dcg,
        count_type=Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
        percent_type=Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    )


@data_condition_translator_registry.register(EventFrequencyPercentCondition.id)
def create_percent_sessions_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataCondition:
    return create_base_event_frequency_data_condition(
        data=data,
        dcg=dcg,
        count_type=Condition.PERCENT_SESSIONS_COUNT,
        percent_type=Condition.PERCENT_SESSIONS_PERCENT,
    )


def create_event_unique_user_frequency_condition_with_conditions(
    data: dict[str, Any], dcg: DataConditionGroup, conditions: list[dict[str, Any]] | None = None
) -> DataCondition:
    comparison_type = data.get("comparisonType", ComparisonType.COUNT)

    comparison = {
        "interval": data["interval"],
        "value": data["value"],
    }

    if comparison_type == ComparisonType.COUNT:
        type = Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT
    else:
        type = Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT
        comparison["comparison_interval"] = data["comparisonInterval"]

    comparison_filters = []

    if conditions:
        for condition in conditions:
            if condition["id"] in (EventAttributeFilter.id, TaggedEventFilter.id):
                comparison_filter = {
                    "match": condition["match"],
                    "key": (
                        condition["attribute"]
                        if condition["id"] == EventAttributeFilter.id
                        else condition["key"]
                    ),
                }
                if comparison_filter["match"] not in {MatchType.IS_SET, MatchType.NOT_SET}:
                    comparison_filter["value"] = condition["value"]
            else:
                raise ValueError(f"Unsupported nested condition: {condition["id"]}")

            comparison_filters.append(comparison_filter)

    comparison["filters"] = comparison_filters

    return DataCondition(
        type=type,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )
