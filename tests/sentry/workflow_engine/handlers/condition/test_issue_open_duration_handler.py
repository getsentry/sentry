from datetime import datetime, timedelta

import pytest
from django.utils import timezone
from jsonschema import ValidationError

from sentry.incidents.grouptype import MetricIssue
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.rules.age import AgeComparisonType
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


@pytest.mark.skip()
@freeze_time(datetime.now().replace(hour=0, minute=0, second=0, microsecond=0))
class TestIssueOpenDurationCondition(ConditionTestCase):
    condition = Condition.ISSUE_OPEN_DURATION

    def setUp(self) -> None:
        super().setUp()
        self.group, self.event, self.group_event = self.create_group_event(
            group_type_id=MetricIssue.type_id
        )
        self.open_period = get_latest_open_period(self.group)
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group_event.group)
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "type": AgeComparisonType.OLDER,
                "value": 10,
                "time_unit": "minute",
            },
            condition_result=True,
        )

    def test_json_schema(self) -> None:
        self.dc.comparison.update({"type": AgeComparisonType.NEWER})
        self.dc.save()

        self.dc.comparison.update({"time_unit": "asdf"})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"value": "bad_value"})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"type": "bad_value"})
        with pytest.raises(ValidationError):
            self.dc.save()

    def test_older_applies_correctly(self) -> None:
        assert self.open_period is not None
        self.open_period.update(date_started=timezone.now())
        self.open_period.save()

        self.assert_does_not_pass(self.dc, self.event_data)

        self.open_period.update(date_started=timezone.now() - timedelta(hours=1))
        self.open_period.save()

        self.assert_passes(self.dc, self.event_data)

    def test_newer_applies_correctly(self) -> None:
        assert self.open_period is not None
        self.dc.comparison.update({"type": AgeComparisonType.NEWER})
        self.dc.save()

        self.open_period.update(date_started=timezone.now())
        self.open_period.save()
        self.assert_passes(self.dc, self.event_data)

        self.open_period.update(date_started=timezone.now() - timedelta(hours=1))
        self.open_period.save()

        self.assert_does_not_pass(self.dc, self.event_data)

    def test_no_open_period(self) -> None:
        assert self.open_period is not None
        self.open_period.delete()
        self.assert_does_not_pass(self.dc, self.event_data)
