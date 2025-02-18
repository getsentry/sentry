import pytest
from jsonschema import ValidationError

from sentry.rules.conditions.event_frequency import (
    ComparisonType,
    EventFrequencyCondition,
    EventFrequencyPercentCondition,
    EventUniqueUserFrequencyCondition,
)
from sentry.rules.match import MatchType
from sentry.workflow_engine.models.data_condition import Condition
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestEventFrequencyCountCondition(ConditionTestCase):
    condition = Condition.EVENT_FREQUENCY_COUNT
    payload = {
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

        results = [self.payload["value"] + 1]
        self.assert_slow_condition_passes(dc, results)

        results = [self.payload["value"] - 1]
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

        results = [self.payload["value"] + 1]
        self.assert_slow_condition_passes(dc, results)

        results = [self.payload["value"] - 1]
        self.assert_slow_condition_does_not_pass(dc, results)

    def test_dual_write_count(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)
        assert dc

        assert dc.type == self.condition
        assert dc.comparison == {
            "interval": self.payload["interval"],
            "value": self.payload["value"],
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

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
    condition = Condition.EVENT_FREQUENCY_PERCENT
    payload = {
        "interval": "1h",
        "id": EventFrequencyCondition.id,
        "value": 50,
        "comparisonType": ComparisonType.PERCENT,
        "comparisonInterval": "1d",
    }

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

    def test_dual_write_percent(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)
        assert dc

        assert dc.type == self.condition
        assert dc.comparison == {
            "interval": self.payload["interval"],
            "value": self.payload["value"],
            "comparison_interval": self.payload["comparisonInterval"],
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_json_schema(self):
        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "asdf",
                    "value": 100,
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


class TestEventUniqueUserFrequencyCountCondition(TestEventFrequencyCountCondition):
    condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT
    payload = {
        "interval": "1h",
        "id": EventUniqueUserFrequencyCondition.id,
        "value": 50,
        "comparisonType": ComparisonType.COUNT,
    }


class TestEventUniqueUserFrequencyPercentCondition(TestEventFrequencyPercentCondition):
    condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT
    payload = {
        "interval": "1h",
        "id": EventUniqueUserFrequencyCondition.id,
        "value": 50,
        "comparisonType": ComparisonType.PERCENT,
        "comparisonInterval": "1d",
    }


class TestPercentSessionsCountCondition(TestEventFrequencyCountCondition):
    condition = Condition.PERCENT_SESSIONS_COUNT
    payload = {
        "interval": "1h",
        "id": EventFrequencyPercentCondition.id,
        "value": 17.2,
        "comparisonType": ComparisonType.COUNT,
    }


class TestPercentSessionsPercentCondition(TestEventFrequencyPercentCondition):
    condition = Condition.PERCENT_SESSIONS_PERCENT
    payload = {
        "interval": "1h",
        "id": EventFrequencyPercentCondition.id,
        "value": 17.2,
        "comparisonType": ComparisonType.PERCENT,
        "comparisonInterval": "1d",
    }
