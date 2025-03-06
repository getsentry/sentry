from datetime import datetime, timedelta, timezone

import pytest
from jsonschema import ValidationError

from sentry.rules.age import AgeComparisonType
from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


@freeze_time(datetime.now().replace(hour=0, minute=0, second=0, microsecond=0))
class TestAgeComparisonCondition(ConditionTestCase):
    condition = Condition.AGE_COMPARISON

    def setup_group_event_and_job(self):
        self.group_event = self.event.for_group(self.group)
        self.job = WorkflowJob(
            {
                "event": self.group_event,
            }
        )

    def setUp(self):
        super().setUp()
        self.job = WorkflowJob(
            {
                "event": self.group_event,
            }
        )
        self.payload = {
            "id": AgeComparisonFilter.id,
            "comparison_type": AgeComparisonType.OLDER,
            "value": "10",
            "time": "hour",
        }
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={"comparison_type": AgeComparisonType.OLDER, "value": 10, "time": "hour"},
            condition_result=True,
        )

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "comparison_type": AgeComparisonType.OLDER,
            "value": 10,
            "time": "hour",
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_dual_write__negative_value(self):
        self.payload["value"] = "-10"
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "comparison_type": AgeComparisonType.NEWER,
            "value": 10,
            "time": "hour",
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_json_schema(self):
        self.dc.comparison.update({"comparison_type": AgeComparisonType.NEWER})
        self.dc.save()

        self.dc.comparison.update({"time": "asdf"})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"value": "bad_value"})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"comparison_type": "bad_value"})
        with pytest.raises(ValidationError):
            self.dc.save()

    def test_older_applies_correctly(self):
        self.dc.comparison.update(
            {"comparison_type": AgeComparisonType.OLDER, "value": 10, "time": "hour"}
        )
        self.dc.save()

        self.group.update(first_seen=datetime.now(timezone.utc) - timedelta(hours=3))
        self.assert_does_not_pass(self.dc, self.job)

        self.group.update(
            first_seen=datetime.now(timezone.utc) - timedelta(hours=10, milliseconds=1)
        )
        self.assert_passes(self.dc, self.job)

    def test_newer_applies_correctly(self):
        self.dc.comparison.update(
            {"comparison_type": AgeComparisonType.NEWER, "value": 10, "time": "hour"}
        )
        self.dc.save()

        self.group.update(first_seen=datetime.now(timezone.utc) - timedelta(hours=3))
        self.assert_passes(self.dc, self.job)

        self.group.update(first_seen=datetime.now(timezone.utc) - timedelta(hours=10))
        self.assert_does_not_pass(self.dc, self.job)
