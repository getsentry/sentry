import pytest
from jsonschema import ValidationError

from sentry.rules.conditions.event_frequency import ComparisonType, EventFrequencyCondition
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestEventFrequencyCountCondition(ConditionTestCase):
    condition = Condition.EVENT_FREQUENCY_COUNT
    payload = {
        "interval": "1h",
        "id": EventFrequencyCondition.id,
        "value": 1000,
        "comparisonType": ComparisonType.COUNT,
    }

    def setUp(self):
        super().setUp()
        self.job = WorkflowJob({"event": self.group_event})

    def test_count(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison={"interval": "1h", "value": 1000},
            condition_result=True,
        )

        self.job["snuba_results"] = [1001]
        self.assert_passes(dc, self.job)

        self.job["snuba_results"] = [999]
        self.assert_does_not_pass(dc, self.job)

    def test_dual_write_count(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "interval": "1h",
            "value": 1000,
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


class TestEventFrequencyPercentCondition(ConditionTestCase):
    condition = Condition.EVENT_FREQUENCY_PERCENT
    payload = {
        "interval": "1h",
        "id": EventFrequencyCondition.id,
        "value": 1000,
        "comparisonType": ComparisonType.PERCENT,
        "comparisonInterval": "1d",
    }

    def setUp(self):
        super().setUp()
        self.job = WorkflowJob({"event": self.group_event})

    def test_percent(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "interval": "1h",
                "value": 100,
                "comparison_interval": "1d",
            },
            condition_result=True,
        )

        self.job["snuba_results"] = [21, 10]
        self.assert_passes(dc, self.job)

        self.job["snuba_results"] = [20, 10]
        self.assert_does_not_pass(dc, self.job)

    def test_dual_write_percent(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "interval": "1h",
            "value": 1000,
            "comparison_interval": "1d",
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
