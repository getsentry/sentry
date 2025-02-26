import pytest
from jsonschema import ValidationError

from sentry.rules.conditions.event_frequency import (
    PERCENT_INTERVALS,
    STANDARD_INTERVALS,
    ComparisonType,
    EventFrequencyCondition,
    EventFrequencyPercentCondition,
    EventUniqueUserFrequencyCondition,
    EventUniqueUserFrequencyConditionWithConditions,
)
from sentry.rules.conditions.first_seen_event import FirstSeenEventCondition
from sentry.rules.filters.event_attribute import EventAttributeFilter
from sentry.rules.filters.tagged_event import TaggedEventFilter
from sentry.rules.match import MatchType
from sentry.workflow_engine.migration_helpers.issue_alert_conditions import (
    create_event_unique_user_frequency_condition_with_conditions,
)
from sentry.workflow_engine.models.data_condition import Condition
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestEventFrequencyCountCondition(ConditionTestCase):
    def setUp(self):
        super().setUp()
        self.condition = Condition.EVENT_FREQUENCY_COUNT
        self.payload: dict[str, int | str] = {
            "interval": "1h",
            "id": EventFrequencyCondition.id,
            "value": 50,
            "comparisonType": ComparisonType.COUNT,
        }

    def test_count(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison={"interval": self.payload["interval"], "value": self.payload["value"]},
            condition_result=True,
        )

        results = [dc.comparison["value"] + 1]
        self.assert_slow_condition_passes(dc, results)

        results = [dc.comparison["value"] - 1]
        self.assert_slow_condition_does_not_pass(dc, results)

    def test_count_with_filters(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "interval": self.payload["interval"],
                "value": self.payload["value"],
                "filters": [
                    {"match": MatchType.EQUAL, "key": "LOGGER", "value": "sentry.example"},
                    {"match": MatchType.IS_SET, "key": "environment"},
                ],
            },
            condition_result=True,
        )

        results = [dc.comparison["value"] + 1]
        self.assert_slow_condition_passes(dc, results)

        results = [dc.comparison["value"] - 1]
        self.assert_slow_condition_does_not_pass(dc, results)

    def _test_dual_write(self, value: int):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "interval": self.payload["interval"],
            "value": value,
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

        # test without comparisonType
        del self.payload["comparisonType"]
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "interval": self.payload["interval"],
            "value": value,
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_dual_write_count(self):
        self._test_dual_write(int(self.payload["value"]))

    def test_dual_write_count__string_value(self):
        self.payload["value"] = str(self.payload["value"])
        self._test_dual_write(int(self.payload["value"]))

    def test_json_schema(self):
        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "asdf",
                    "value": 100,
                },
                condition_result=True,
            )

        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "1d",
                    "value": -1,
                },
                condition_result=True,
            )

        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "1d",
                    "value": 100,
                    "comparison_interval": "asdf",
                    "filters": [
                        {"match": MatchType.IS_SET, "key": "LOGGER", "value": "sentry.example"}
                    ],
                },
                condition_result=True,
            )


class TestEventFrequencyPercentCondition(ConditionTestCase):
    def setUp(self):
        self.condition = Condition.EVENT_FREQUENCY_PERCENT
        self.payload: dict[str, int | str] = {
            "interval": "1h",
            "id": EventFrequencyCondition.id,
            "value": 50,
            "comparisonType": ComparisonType.PERCENT,
            "comparisonInterval": "1d",
        }
        self.intervals = STANDARD_INTERVALS
        self.other_intervals = PERCENT_INTERVALS

    def test_percent(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "interval": self.payload["interval"],
                "value": self.payload["value"],
                "comparison_interval": self.payload["comparisonInterval"],
            },
            condition_result=True,
        )

        results = [16, 10]
        self.assert_slow_condition_passes(dc, results)

        results = [10, 10]
        self.assert_slow_condition_does_not_pass(dc, results)

    def test_percent_with_filters(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "interval": self.payload["interval"],
                "value": self.payload["value"],
                "comparison_interval": self.payload["comparisonInterval"],
                "filters": [
                    {"match": MatchType.EQUAL, "key": "LOGGER", "value": "sentry.example"},
                    {"match": MatchType.IS_SET, "key": "environment"},
                ],
            },
            condition_result=True,
        )

        results = [16, 10]
        self.assert_slow_condition_passes(dc, results)

        results = [10, 10]
        self.assert_slow_condition_does_not_pass(dc, results)

    def _test_dual_write(self, value: int):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "interval": self.payload["interval"],
            "value": value,
            "comparison_interval": self.payload["comparisonInterval"],
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_dual_write_percent(self):
        self._test_dual_write(int(self.payload["value"]))

    def test_dual_write_percent__string_value(self):
        self.payload["value"] = str(self.payload["value"])
        self._test_dual_write(int(self.payload["value"]))

    def test_json_schema(self):
        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "asdf",
                    "value": "100",
                    "comparison_interval": "1d",
                },
                condition_result=True,
            )

        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "1d",
                    "value": -1,
                    "comparison_interval": "1d",
                },
                condition_result=True,
            )

        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "1d",
                    "value": 100,
                    "comparison_interval": "asdf",
                },
                condition_result=True,
            )

        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "1d",
                    "value": 100,
                    "comparison_interval": "asdf",
                    "filters": [{"match": "asdf", "key": "LOGGER", "value": "sentry.example"}],
                },
                condition_result=True,
            )

        invalid_interval = list(set(self.other_intervals.keys()) - set(self.intervals.keys()))[0]
        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": invalid_interval,
                    "value": 100,
                    "comparison_interval": "1d",
                },
                condition_result=True,
            )


class TestEventUniqueUserFrequencyCountCondition(TestEventFrequencyCountCondition):
    def setUp(self):
        super().setUp()
        self.condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT
        self.payload: dict[str, int | str] = {
            "interval": "1h",
            "id": EventUniqueUserFrequencyCondition.id,
            "value": 50,
            "comparisonType": ComparisonType.COUNT,
        }


class TestEventUniqueUserFrequencyPercentCondition(TestEventFrequencyPercentCondition):
    def setUp(self):
        super().setUp()
        self.condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT
        self.payload: dict[str, int | str] = {
            "interval": "1h",
            "id": EventUniqueUserFrequencyCondition.id,
            "value": 50,
            "comparisonType": ComparisonType.PERCENT,
            "comparisonInterval": "1d",
        }


class TestPercentSessionsCountCondition(TestEventFrequencyCountCondition):
    def setUp(self):
        super().setUp()
        self.condition = Condition.PERCENT_SESSIONS_COUNT
        self.payload: dict[str, int | str] = {
            "interval": "30m",  # only percent sessions allows 30m
            "id": EventFrequencyPercentCondition.id,
            "value": 17,
            "comparisonType": ComparisonType.COUNT,
        }
        self.intervals = PERCENT_INTERVALS
        self.other_intervals = STANDARD_INTERVALS


class TestPercentSessionsPercentCondition(TestEventFrequencyPercentCondition):
    def setUp(self):
        super().setUp()
        self.condition = Condition.PERCENT_SESSIONS_PERCENT
        self.payload: dict[str, int | str] = {
            "interval": "30m",  # only percent sessions allows 30m
            "id": EventFrequencyPercentCondition.id,
            "value": 17,
            "comparisonType": ComparisonType.PERCENT,
            "comparisonInterval": "1d",
        }
        self.intervals = PERCENT_INTERVALS
        self.other_intervals = STANDARD_INTERVALS


class TestEventUniqueUserFrequencyConditionWithConditions(ConditionTestCase):
    def setUp(self):
        super().setUp()
        self.condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT
        self.payload: dict[str, int | str] = {
            "interval": "1h",
            "id": EventUniqueUserFrequencyConditionWithConditions.id,
            "value": 50,
            "comparisonType": ComparisonType.COUNT,
        }

        self.conditions = [
            {
                "id": TaggedEventFilter.id,
                "match": MatchType.EQUAL,
                "key": "LOGGER",
                "value": "sentry.example",
            },
            {
                "id": TaggedEventFilter.id,
                "match": MatchType.IS_SET,
                "key": "environment",
            },
            {
                "id": EventAttributeFilter.id,
                "match": MatchType.EQUAL,
                "value": "hi",
                "attribute": "message",
            },
        ]
        self.expected_filters = [
            {
                "match": MatchType.EQUAL,
                "key": self.conditions[0]["key"],
                "value": self.conditions[0]["value"],
            },
            {"match": MatchType.IS_SET, "key": self.conditions[1]["key"]},
            {
                "match": MatchType.EQUAL,
                "key": self.conditions[2]["attribute"],
                "value": self.conditions[2]["value"],
            },
        ]
        self.dcg = self.create_data_condition_group()

    def _test_dual_write_count(self, value: int):
        dc = create_event_unique_user_frequency_condition_with_conditions(
            self.payload, self.dcg, self.conditions
        )

        assert dc.type == self.condition
        assert dc.comparison == {
            "interval": self.payload["interval"],
            "value": value,
            "filters": self.expected_filters,
        }
        assert dc.condition_result is True
        assert dc.condition_group == self.dcg

    def test_dual_write_count(self):
        self._test_dual_write_count(int(self.payload["value"]))

    def test_dual_write_count__string_value(self):
        self.payload["value"] = str(self.payload["value"])
        self._test_dual_write_count(int(self.payload["value"]))

    def _test_dual_write_percent(self, value: int):
        self.payload.update({"comparisonType": ComparisonType.PERCENT, "comparisonInterval": "1d"})
        dc = create_event_unique_user_frequency_condition_with_conditions(
            self.payload, self.dcg, self.conditions
        )

        assert dc.type == Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT
        assert dc.comparison == {
            "interval": self.payload["interval"],
            "value": value,
            "comparison_interval": self.payload["comparisonInterval"],
            "filters": self.expected_filters,
        }
        assert dc.condition_result is True
        assert dc.condition_group == self.dcg

    def test_dual_write_percent(self):
        self._test_dual_write_percent(int(self.payload["value"]))

    def test_dual_write_percent__string_value(self):
        self.payload["value"] = str(self.payload["value"])
        self._test_dual_write_percent(int(self.payload["value"]))

    def test_dual_write__invalid(self):
        with pytest.raises(KeyError):
            create_event_unique_user_frequency_condition_with_conditions(
                self.payload,
                self.dcg,
                [
                    {
                        "id": EventAttributeFilter.id,
                        "match": MatchType.EQUAL,
                        "value": "hi",
                    },
                ],
            )

        with pytest.raises(ValueError):  # unsupported filter condition
            create_event_unique_user_frequency_condition_with_conditions(
                self.payload,
                self.dcg,
                [
                    {
                        "id": FirstSeenEventCondition.id,
                    },
                ],
            )

    def test_json_schema(self):
        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "asdf",
                    "value": "100",
                    "filters": "asdf",
                },
                condition_result=True,
            )

        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "1d",
                    "value": "100",
                    "filters": [{"interval": "1d", "value": "100"}],
                },
                condition_result=True,
            )
