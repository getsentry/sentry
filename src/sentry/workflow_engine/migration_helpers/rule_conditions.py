from typing import int, Any

from sentry.rules.conditions.event_frequency import ComparisonType
from sentry.workflow_engine.models.data_condition import Condition, DataCondition

ConditionAndFilters = tuple[dict[str, Any], list[dict[str, Any]]]


def create_escalating_event_condition(
    data_condition: DataCondition,
    is_filter: bool = False,
) -> ConditionAndFilters:
    return {"id": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"}, []


def create_regression_event_condition(
    data_condition: DataCondition,
    is_filter: bool = False,
) -> ConditionAndFilters:
    return {
        "id": "sentry.rules.conditions.regression_event.RegressionEventCondition",
    }, []


def create_existing_high_priority_issue_condition(
    data_condition: DataCondition,
    is_filter: bool = False,
) -> ConditionAndFilters:
    return {
        "id": "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition"
    }, []


def create_event_attribute_condition(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    if is_filter:
        id = "sentry.rules.filters.event_attribute.EventAttributeFilter"
    else:
        id = "sentry.rules.conditions.event_attribute.EventAttributeCondition"
    payload = {
        "id": id,
        "match": data_condition.comparison["match"],
        "value": data_condition.comparison.get("value", ""),
        "attribute": data_condition.comparison["attribute"],
    }

    if is_filter:
        return {}, [payload]

    return payload, []


def create_first_seen_event_condition(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    return {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}, []


def create_new_high_priority_issue_condition(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    return {"id": "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition"}, []


def create_level_condition(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    if is_filter:
        id = "sentry.rules.filters.level.LevelFilter"
    else:
        id = "sentry.rules.conditions.level.LevelCondition"

    payload = {
        "id": id,
        "match": data_condition.comparison["match"],
        "level": str(data_condition.comparison["level"]),
    }

    if is_filter:
        return {}, [payload]

    return payload, []


def create_tagged_event_condition(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    if is_filter:
        id = "sentry.rules.filters.tagged_event.TaggedEventFilter"
    else:
        id = "sentry.rules.conditions.tagged_event.TaggedEventCondition"

    payload = {
        "id": id,
        "match": data_condition.comparison["match"],
        "value": data_condition.comparison.get("value", ""),
        "key": data_condition.comparison["key"],
    }

    if is_filter:
        return {}, [payload]

    return payload, []


def create_age_comparison_filter(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    return {}, [
        {
            "id": "sentry.rules.filters.age_comparison.AgeComparisonFilter",
            "comparison_type": str(data_condition.comparison["comparison_type"]),
            "value": data_condition.comparison["value"],
            "time": data_condition.comparison["time"],
        }
    ]


def create_assigned_to_filter(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    payload = {
        "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
        "targetType": data_condition.comparison["target_type"],
    }
    if data_condition.comparison.get("target_identifier"):
        payload["targetIdentifier"] = data_condition.comparison["target_identifier"]

    return {}, [payload]


def create_issue_category_filter(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    return {}, [
        {
            "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
            "value": data_condition.comparison["value"],
        }
    ]


def create_issue_occurrences_filter(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    return {}, [
        {
            "id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter",
            "value": data_condition.comparison["value"],
        }
    ]


def create_latest_release_filter(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    return {}, [
        {
            "id": "sentry.rules.filters.latest_release.LatestReleaseFilter",
        }
    ]


def create_latest_adopted_release_filter(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    return {}, [
        {
            "id": "sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter",
            "oldest_or_newest": data_condition.comparison["release_age_type"],
            "older_or_newer": data_condition.comparison["age_comparison"],
            "environment": data_condition.comparison["environment"],
        }
    ]


def create_base_event_frequency_condition(
    id: str,
    data_condition: DataCondition,
    count_type: Condition,
    percent_type: Condition,
) -> ConditionAndFilters:
    payload = {
        "id": id,
        "comparisonType": (
            ComparisonType.COUNT if data_condition.type == count_type else ComparisonType.PERCENT
        ),
        "interval": data_condition.comparison["interval"],
        "value": data_condition.comparison["value"],
    }

    if data_condition.type == percent_type:
        payload["comparisonInterval"] = data_condition.comparison["comparison_interval"]

    return payload, []


def create_event_frequency_condition(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    return create_base_event_frequency_condition(
        id="sentry.rules.conditions.event_frequency.EventFrequencyCondition",
        data_condition=data_condition,
        count_type=Condition.EVENT_FREQUENCY_COUNT,
        percent_type=Condition.EVENT_FREQUENCY_PERCENT,
    )


def create_percent_sessions_condition(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    return create_base_event_frequency_condition(
        id="sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
        data_condition=data_condition,
        count_type=Condition.PERCENT_SESSIONS_COUNT,
        percent_type=Condition.PERCENT_SESSIONS_PERCENT,
    )


def create_event_unique_user_frequency_condition(
    data_condition: DataCondition, is_filter: bool = False
) -> ConditionAndFilters:
    filters: list[dict[str, Any]] = []
    if data_condition.comparison.get("filters"):
        condition = {
            "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions",
            "comparisonType": (
                ComparisonType.COUNT
                if data_condition.type == Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT
                else ComparisonType.PERCENT
            ),
            "interval": data_condition.comparison["interval"],
            "value": data_condition.comparison["value"],
        }
        if data_condition.type == Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT:
            condition["comparisonInterval"] = data_condition.comparison["comparison_interval"]

        filters = []
        for filter in data_condition.comparison["filters"]:
            has_attribute = filter.get("attribute") is not None
            if has_attribute:
                filter_payload = {
                    "id": "sentry.rules.filters.event_attribute.EventAttributeFilter",
                    "attribute": filter["attribute"],
                    "match": filter["match"],
                }
            else:
                filter_payload = {
                    "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                    "key": filter["key"],
                    "match": filter["match"],
                }
            filter_payload["value"] = filter.get("value", "")

            filters.append(filter_payload)

        return condition, filters

    return create_base_event_frequency_condition(
        id="sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
        data_condition=data_condition,
        count_type=Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
        percent_type=Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    )


data_condition_to_rule_condition_mapping = {
    Condition.REAPPEARED_EVENT: create_escalating_event_condition,
    Condition.REGRESSION_EVENT: create_regression_event_condition,
    Condition.EXISTING_HIGH_PRIORITY_ISSUE: create_existing_high_priority_issue_condition,
    Condition.NEW_HIGH_PRIORITY_ISSUE: create_new_high_priority_issue_condition,
    Condition.LEVEL: create_level_condition,
    Condition.EVENT_ATTRIBUTE: create_event_attribute_condition,
    Condition.FIRST_SEEN_EVENT: create_first_seen_event_condition,
    Condition.TAGGED_EVENT: create_tagged_event_condition,
    Condition.AGE_COMPARISON: create_age_comparison_filter,
    Condition.ASSIGNED_TO: create_assigned_to_filter,
    Condition.ISSUE_CATEGORY: create_issue_category_filter,
    Condition.ISSUE_OCCURRENCES: create_issue_occurrences_filter,
    Condition.LATEST_RELEASE: create_latest_release_filter,
    Condition.LATEST_ADOPTED_RELEASE: create_latest_adopted_release_filter,
    Condition.EVENT_FREQUENCY_COUNT: create_event_frequency_condition,
    Condition.EVENT_FREQUENCY_PERCENT: create_event_frequency_condition,
    Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT: create_event_unique_user_frequency_condition,
    Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT: create_event_unique_user_frequency_condition,
    Condition.PERCENT_SESSIONS_COUNT: create_percent_sessions_condition,
    Condition.PERCENT_SESSIONS_PERCENT: create_percent_sessions_condition,
}


def translate_to_rule_condition_filters(
    data_condition: DataCondition, is_filter: bool
) -> ConditionAndFilters:
    translator = data_condition_to_rule_condition_mapping.get(Condition(data_condition.type))
    if not translator:
        raise ValueError(f"Unsupported condition: {data_condition.type}")

    return translator(data_condition, is_filter)
