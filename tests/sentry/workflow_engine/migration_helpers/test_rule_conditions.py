from typing import Any

from sentry.workflow_engine.migration_helpers.issue_alert_conditions import (
    create_event_unique_user_frequency_condition_with_conditions,
)
from sentry.workflow_engine.migration_helpers.rule_conditions import (
    translate_to_rule_condition_filters,
)
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class RuleConditionTranslationTest(ConditionTestCase):
    def setUp(self) -> None:
        self.dcg = self.create_data_condition_group()

    def assert_basic_condition_translated(self, payload: dict[str, Any]) -> None:
        dc = self.translate_to_data_condition(payload, self.dcg)
        condition, filters = translate_to_rule_condition_filters(dc, is_filter=False)
        assert condition == payload
        assert filters == []

    def assert_basic_filter_translated(self, payload: dict[str, Any]) -> None:
        dc = self.translate_to_data_condition(payload, self.dcg)
        condition, filters = translate_to_rule_condition_filters(dc, is_filter=True)
        assert condition == {}
        assert filters == [payload]

    def test_escalating_event(self) -> None:
        payload = {"id": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"}
        self.assert_basic_condition_translated(payload)

    def test_regression_event(self) -> None:
        payload = {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"}
        self.assert_basic_condition_translated(payload)

    def test_existing_high_priority_issue(self) -> None:
        payload = {
            "id": "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition"
        }
        self.assert_basic_condition_translated(payload)

    def test_event_attribute_condition(self) -> None:
        payload = {
            "id": "sentry.rules.conditions.event_attribute.EventAttributeCondition",
            "attribute": "http.url",
            "match": "nc",
            "value": "localhost",
        }
        self.assert_basic_condition_translated(payload)

    def test_event_attribute_filter(self) -> None:
        payload = {
            "id": "sentry.rules.filters.event_attribute.EventAttributeFilter",
            "attribute": "http.url",
            "match": "nc",
            "value": "localhost",
        }
        self.assert_basic_filter_translated(payload)

    def test_first_seen_event(self) -> None:
        payload = {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
        self.assert_basic_condition_translated(payload)

    def test_new_high_priority_issue(self) -> None:
        payload = {
            "id": "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition"
        }
        self.assert_basic_condition_translated(payload)

    def test_level_condition(self) -> None:
        payload = {
            "id": "sentry.rules.conditions.level.LevelCondition",
            "match": "eq",
            "level": "50",
        }
        self.assert_basic_condition_translated(payload)

    def test_level_filter(self) -> None:
        payload = {
            "id": "sentry.rules.filters.level.LevelFilter",
            "match": "eq",
            "level": "50",
        }
        self.assert_basic_filter_translated(payload)

    def test_tagged_event_condition(self) -> None:
        payload = {
            "id": "sentry.rules.conditions.tagged_event.TaggedEventCondition",
            "key": "level",
            "match": "eq",
            "value": "error",
        }
        self.assert_basic_condition_translated(payload)

    def test_tagged_event_filter(self) -> None:
        payload = {
            "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
            "key": "level",
            "match": "eq",
            "value": "error",
        }
        self.assert_basic_filter_translated(payload)

    def test_age_comparison_filter(self) -> None:
        payload = {
            "id": "sentry.rules.filters.age_comparison.AgeComparisonFilter",
            "comparison_type": "older",
            "value": 3,
            "time": "week",
        }
        self.assert_basic_filter_translated(payload)

    def test_assigned_to_filter(self) -> None:
        payload: dict[str, Any] = {
            "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
            "targetType": "Unassigned",
        }
        self.assert_basic_filter_translated(payload)

        payload = {
            "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
            "targetType": "Member",
            "targetIdentifier": 895329789,
        }
        self.assert_basic_filter_translated(payload)

    def test_issue_category(self) -> None:
        payload = {"id": "sentry.rules.filters.issue_category.IssueCategoryFilter", "value": 2}
        self.assert_basic_filter_translated(payload)

    def test_issue_occurrences(self) -> None:
        payload = {
            "id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter",
            "value": 120,
        }
        self.assert_basic_filter_translated(payload)

    def test_latest_release(self) -> None:
        payload = {"id": "sentry.rules.filters.latest_release.LatestReleaseFilter"}
        self.assert_basic_filter_translated(payload)

    def test_latest_adopted_release(self) -> None:
        payload = {
            "id": "sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter",
            "oldest_or_newest": "oldest",
            "older_or_newer": "newer",
            "environment": "prod",
        }
        self.assert_basic_filter_translated(payload)

    def test_event_frequency_count(self) -> None:
        payload = {
            "interval": "1h",
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "value": 50,
            "comparisonType": "count",
        }
        self.assert_basic_condition_translated(payload)

    def test_event_frequency_percent(self) -> None:
        payload = {
            "interval": "1h",
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "value": 50,
            "comparisonType": "percent",
            "comparisonInterval": "1h",
        }
        self.assert_basic_condition_translated(payload)

    def test_event_unique_user_frequency_count(self) -> None:
        payload = {
            "interval": "1h",
            "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
            "value": 50,
            "comparisonType": "count",
        }
        self.assert_basic_condition_translated(payload)

    def test_event_unique_user_frequency_percent(self) -> None:
        payload = {
            "interval": "1h",
            "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
            "value": 50,
            "comparisonType": "percent",
            "comparisonInterval": "1h",
        }
        self.assert_basic_condition_translated(payload)

    def test_percent_sessions_count(self) -> None:
        payload = {
            "interval": "1h",
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
            "value": 17.2,
            "comparisonType": "count",
        }
        self.assert_basic_condition_translated(payload)

    def test_percent_sessions_percent(self) -> None:
        payload = {
            "interval": "1h",
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
            "value": 17.2,
            "comparisonType": "percent",
            "comparisonInterval": "1h",
        }
        self.assert_basic_condition_translated(payload)

    def test_event_unique_user_frequency_with_conditions(self) -> None:
        payload: dict[str, str | int | float] = {
            "interval": "1h",
            "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions",
            "value": 50,
            "comparisonType": "count",
        }

        conditions = [
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "match": "eq",
                "key": "LOGGER",
                "value": "sentry.example",
            },
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "match": "is",
                "key": "environment",
                "value": "",
            },
            {
                "id": "sentry.rules.filters.event_attribute.EventAttributeFilter",
                "match": "nc",
                "value": "hi",
                "attribute": "message",
            },
        ]
        dc = create_event_unique_user_frequency_condition_with_conditions(
            payload, self.dcg, conditions
        )
        dc.save()
        condition, filters = translate_to_rule_condition_filters(dc, is_filter=False)
        assert condition == payload

        assert len(filters) == len(conditions)
        # Check that the filters are the same as the conditions (dictionaries)
        for filter in filters:
            assert filter in conditions
