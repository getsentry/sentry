import pytest
from jsonschema import ValidationError

from sentry.workflow_engine.handlers.condition.utils.event_frequency import (
    PERCENT_INTERVALS,
    STANDARD_INTERVALS,
)
from sentry.workflow_engine.handlers.condition.utils.match import MatchType
from sentry.workflow_engine.models.data_condition import Condition
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestEventFrequencyCountCondition(ConditionTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.condition = Condition.EVENT_FREQUENCY_COUNT
        self.payload: dict[str, str | int | float] = {
            "interval": "1h",
            "value": 50,
        }

    def test_count(self) -> None:
        dc = self.create_data_condition(
            type=self.condition,
            comparison={"interval": self.payload["interval"], "value": self.payload["value"]},
            condition_result=True,
        )

        results = [dc.comparison["value"] + 1]
        self.assert_slow_condition_passes(dc, results)

        results = [dc.comparison["value"] - 1]
        self.assert_slow_condition_does_not_pass(dc, results)

    def test_count_with_filters(self) -> None:
        dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "interval": self.payload["interval"],
                "value": self.payload["value"],
                "filters": [
                    {
                        "match": MatchType.EQUAL,
                        "key": "LOGGER",
                        "value": "sentry.example",
                    },  # TaggedEvent
                    {"match": MatchType.IS_SET, "key": "environment"},  # TaggedEvent
                    {
                        "match": MatchType.EQUAL,
                        "attribute": "platform",
                        "value": "python",
                    },  # EventAttribute
                ],
            },
            condition_result=True,
        )

        results = [dc.comparison["value"] + 1]
        self.assert_slow_condition_passes(dc, results)

        results = [dc.comparison["value"] - 1]
        self.assert_slow_condition_does_not_pass(dc, results)

    def test_json_schema(self) -> None:
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

        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "1d",
                    "value": 100,
                    "comparison_interval": "asdf",
                    "filters": [{"match": MatchType.EQUAL, "attribute": "platform"}],
                },
                condition_result=True,
            )


class TestEventFrequencyPercentCondition(ConditionTestCase):
    def setUp(self) -> None:
        self.condition = Condition.EVENT_FREQUENCY_PERCENT
        self.payload: dict[str, str | int | float] = {
            "interval": "1h",
            "value": 50,
            "comparisonInterval": "1d",
        }
        self.intervals = STANDARD_INTERVALS
        self.other_intervals = PERCENT_INTERVALS

    def test_percent(self) -> None:
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

    def test_percent_with_filters(self) -> None:
        dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "interval": self.payload["interval"],
                "value": self.payload["value"],
                "comparison_interval": self.payload["comparisonInterval"],
                "filters": [
                    {
                        "match": MatchType.EQUAL,
                        "key": "LOGGER",
                        "value": "sentry.example",
                    },  # TaggedEvent
                    {"match": MatchType.IS_SET, "key": "environment"},  # TaggedEvent
                    {
                        "match": MatchType.EQUAL,
                        "attribute": "platform",
                        "value": "python",
                    },  # EventAttribute
                ],
            },
            condition_result=True,
        )

        results = [16, 10]
        self.assert_slow_condition_passes(dc, results)

        results = [10, 10]
        self.assert_slow_condition_does_not_pass(dc, results)

    def test_with_result_zero(self) -> None:
        dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "interval": self.payload["interval"],
                "value": self.payload["value"],
                "comparison_interval": self.payload["comparisonInterval"],
            },
            condition_result=True,
        )

        results = [10, 0]
        self.assert_slow_condition_passes(dc, results)

    def test_json_schema(self) -> None:
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

        with pytest.raises(ValidationError):
            self.create_data_condition(
                type=self.condition,
                comparison={
                    "interval": "1d",
                    "value": 100,
                    "comparison_interval": "asdf",
                    "filters": [{"match": MatchType.EQUAL, "attribute": "platform"}],
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
    def setUp(self) -> None:
        super().setUp()
        self.condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT


class TestEventUniqueUserFrequencyPercentCondition(TestEventFrequencyPercentCondition):
    def setUp(self) -> None:
        super().setUp()
        self.condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT


class TestPercentSessionsCountCondition(TestEventFrequencyCountCondition):
    def setUp(self) -> None:
        super().setUp()
        self.condition = Condition.PERCENT_SESSIONS_COUNT
        self.payload: dict[str, str | int | float] = {
            "interval": "30m",  # only percent sessions allows 30m
            "value": 17.2,
        }
        self.intervals = PERCENT_INTERVALS
        self.other_intervals = STANDARD_INTERVALS


class TestPercentSessionsPercentCondition(TestEventFrequencyPercentCondition):
    def setUp(self) -> None:
        super().setUp()
        self.condition = Condition.PERCENT_SESSIONS_PERCENT
        self.payload: dict[str, str | int | float] = {
            "interval": "30m",  # only percent sessions allows 30m
            "value": 17.2,
            "comparisonInterval": "1d",
        }
        self.intervals = PERCENT_INTERVALS
        self.other_intervals = STANDARD_INTERVALS


class TestEventUniqueUserFrequencyConditionWithConditions(ConditionTestCase):
    condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT

    def test_json_schema(self) -> None:
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
