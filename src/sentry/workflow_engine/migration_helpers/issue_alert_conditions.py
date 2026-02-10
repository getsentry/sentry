from collections.abc import Callable
from dataclasses import asdict, dataclass
from typing import Any

from sentry.notifications.types import AssigneeTargetType
from sentry.rules.age import AgeComparisonType
from sentry.rules.conditions.event_frequency import ComparisonType
from sentry.rules.match import MatchType
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup


@dataclass
class DataConditionKwargs:
    type: str
    comparison: Any
    condition_result: bool
    condition_group: DataConditionGroup


def create_every_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    return DataConditionKwargs(
        type=Condition.EVERY_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


def create_escalating_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    return DataConditionKwargs(
        type=Condition.REAPPEARED_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


def create_regression_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    return DataConditionKwargs(
        type=Condition.REGRESSION_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


def create_existing_high_priority_issue_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    return DataConditionKwargs(
        type=Condition.EXISTING_HIGH_PRIORITY_ISSUE,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


def create_event_attribute_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    comparison = {
        "match": data["match"],
        "attribute": data["attribute"],
    }
    if comparison["match"] not in {MatchType.IS_SET, MatchType.NOT_SET}:
        comparison["value"] = data["value"]

    return DataConditionKwargs(
        type=Condition.EVENT_ATTRIBUTE,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


def create_first_seen_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    return DataConditionKwargs(
        type=Condition.FIRST_SEEN_EVENT,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


def create_new_high_priority_issue_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    return DataConditionKwargs(
        type=Condition.NEW_HIGH_PRIORITY_ISSUE,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


def create_level_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    comparison = {"match": data["match"], "level": int(data["level"])}

    return DataConditionKwargs(
        type=Condition.LEVEL,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


def create_tagged_event_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    comparison = {
        "match": data["match"],
        "key": data["key"],
    }
    if comparison["match"] not in {MatchType.IS_SET, MatchType.NOT_SET}:
        comparison["value"] = data["value"]

    return DataConditionKwargs(
        type=Condition.TAGGED_EVENT,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


def create_age_comparison_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    comparison_type = AgeComparisonType(data["comparison_type"])
    value = int(data["value"])
    if value < 0:
        # make all values positive and switch the comparison type
        value = -1 * value
        comparison_type = (
            AgeComparisonType.NEWER
            if comparison_type == AgeComparisonType.OLDER
            else AgeComparisonType.OLDER
        )

    comparison = {
        "comparison_type": comparison_type,
        "value": value,
        "time": data["time"],
    }

    return DataConditionKwargs(
        type=Condition.AGE_COMPARISON,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


def create_assigned_to_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    comparison = {
        "target_type": data["targetType"],
    }

    if data["targetType"] != AssigneeTargetType.UNASSIGNED:
        comparison["target_identifier"] = data["targetIdentifier"]

    return DataConditionKwargs(
        type=Condition.ASSIGNED_TO,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


def create_issue_category_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    comparison = {
        "value": int(data["value"]),
    }
    include = data.get("include")
    if isinstance(include, bool):
        comparison["include"] = include

    return DataConditionKwargs(
        type=Condition.ISSUE_CATEGORY,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


def create_issue_occurrences_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    comparison = {"value": max(int(data["value"]), 0)}

    return DataConditionKwargs(
        type=Condition.ISSUE_OCCURRENCES,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


def create_latest_release_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    return DataConditionKwargs(
        type=Condition.LATEST_RELEASE,
        comparison=True,
        condition_result=True,
        condition_group=dcg,
    )


def create_latest_adopted_release_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    comparison = {
        "release_age_type": data["oldest_or_newest"],
        "age_comparison": data["older_or_newer"],
        "environment": data["environment"],
    }
    return DataConditionKwargs(
        type=Condition.LATEST_ADOPTED_RELEASE,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


def create_base_event_frequency_data_condition(
    value: int | float,
    data: dict[str, Any],
    dcg: DataConditionGroup,
    count_type: Condition,
    percent_type: Condition,
) -> DataConditionKwargs:
    comparison_type = data.get(
        "comparisonType", ComparisonType.COUNT
    )  # this is camelCase, age comparison is snake_case
    comparison_type = ComparisonType(comparison_type)

    value = max(value, 0)  # force to 0 if negative
    comparison = {
        "interval": data["interval"],
        "value": value,
    }

    if comparison_type == ComparisonType.COUNT:
        type = count_type
    else:
        type = percent_type
        comparison["comparison_interval"] = data["comparisonInterval"]

    return DataConditionKwargs(
        type=type,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


def create_event_frequency_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    value = int(data["value"])
    return create_base_event_frequency_data_condition(
        value=value,
        data=data,
        dcg=dcg,
        count_type=Condition.EVENT_FREQUENCY_COUNT,
        percent_type=Condition.EVENT_FREQUENCY_PERCENT,
    )


def create_event_unique_user_frequency_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    value = int(data["value"])
    return create_base_event_frequency_data_condition(
        value=value,
        data=data,
        dcg=dcg,
        count_type=Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
        percent_type=Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    )


def create_percent_sessions_data_condition(
    data: dict[str, Any], dcg: DataConditionGroup
) -> DataConditionKwargs:
    value = float(data["value"])
    return create_base_event_frequency_data_condition(
        value=value,
        data=data,
        dcg=dcg,
        count_type=Condition.PERCENT_SESSIONS_COUNT,
        percent_type=Condition.PERCENT_SESSIONS_PERCENT,
    )


def create_event_unique_user_frequency_condition_with_conditions(
    data: dict[str, Any], dcg: DataConditionGroup, conditions: list[dict[str, Any]] | None = None
) -> DataCondition:
    comparison_type = data.get("comparisonType", ComparisonType.COUNT)
    comparison_type = ComparisonType(comparison_type)
    value = max(int(data["value"]), 0)  # force to 0 if negative

    comparison = {
        "interval": data["interval"],
        "value": value,
    }

    if comparison_type == ComparisonType.COUNT:
        type = Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT
    else:
        type = Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT
        comparison["comparison_interval"] = data["comparisonInterval"]

    comparison_filters = []

    if conditions:
        for condition in conditions:
            condition_id = condition["id"]
            comparison_filter: dict[str, Any] = {}

            match condition_id:
                case "sentry.rules.filters.event_attribute.EventAttributeFilter":
                    comparison_filter["attribute"] = condition["attribute"]
                case "sentry.rules.filters.tagged_event.TaggedEventFilter":
                    comparison_filter["key"] = condition["key"]
                case _:
                    raise ValueError(f"Unsupported condition: {condition_id}")

            match = MatchType(condition["match"])
            comparison_filter["match"] = match

            if match not in {MatchType.IS_SET, MatchType.NOT_SET}:
                comparison_filter["value"] = condition["value"]

            comparison_filters.append(comparison_filter)

    comparison["filters"] = comparison_filters

    return DataCondition(
        type=type,
        comparison=comparison,
        condition_result=True,
        condition_group=dcg,
    )


data_condition_translator_mapping: dict[
    str, Callable[[dict[str, Any], Any], DataConditionKwargs]
] = {
    "sentry.rules.conditions.every_event.EveryEventCondition": create_every_event_data_condition,
    "sentry.rules.conditions.reappeared_event.ReappearedEventCondition": create_escalating_event_data_condition,
    "sentry.rules.conditions.regression_event.RegressionEventCondition": create_regression_event_data_condition,
    "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition": create_existing_high_priority_issue_data_condition,
    "sentry.rules.conditions.event_attribute.EventAttributeCondition": create_event_attribute_data_condition,
    "sentry.rules.filters.event_attribute.EventAttributeFilter": create_event_attribute_data_condition,
    "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition": create_first_seen_event_data_condition,
    "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition": create_new_high_priority_issue_data_condition,
    "sentry.rules.conditions.level.LevelCondition": create_level_data_condition,
    "sentry.rules.filters.level.LevelFilter": create_level_data_condition,
    "sentry.rules.conditions.tagged_event.TaggedEventCondition": create_tagged_event_data_condition,
    "sentry.rules.filters.tagged_event.TaggedEventFilter": create_tagged_event_data_condition,
    "sentry.rules.filters.age_comparison.AgeComparisonFilter": create_age_comparison_data_condition,
    "sentry.rules.filters.assigned_to.AssignedToFilter": create_assigned_to_data_condition,
    "sentry.rules.filters.issue_category.IssueCategoryFilter": create_issue_category_data_condition,
    "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter": create_issue_occurrences_data_condition,
    "sentry.rules.filters.latest_release.LatestReleaseFilter": create_latest_release_data_condition,
    "sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter": create_latest_adopted_release_data_condition,
    "sentry.rules.conditions.event_frequency.EventFrequencyCondition": create_event_frequency_data_condition,
    "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition": create_event_unique_user_frequency_data_condition,
    "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition": create_percent_sessions_data_condition,
}


def translate_to_data_condition(data: dict[str, Any], dcg: DataConditionGroup) -> DataCondition:
    translator = data_condition_translator_mapping.get(data["id"])
    if not translator:
        raise ValueError(f"Unsupported condition: {data['id']}")

    return DataCondition(**asdict(translator(data, dcg)))
