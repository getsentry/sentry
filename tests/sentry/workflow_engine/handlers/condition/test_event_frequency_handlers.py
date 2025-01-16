import pytest
from jsonschema import ValidationError

from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.rules.conditions.event_frequency import ComparisonType, EventFrequencyCondition
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.handlers.condition.event_frequency_handlers import (
    EventFrequencyCountHandler,
)
from sentry.workflow_engine.models.data_condition import Condition
from tests.sentry.workflow_engine.handlers.condition.test_base import (
    ConditionTestCase,
    EventFrequencyQueryTestBase,
)

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class TestEventFrequencyCountCondition(ConditionTestCase):
    condition = Condition.EVENT_FREQUENCY_COUNT
    rule_cls = EventFrequencyCondition
    payload = {
        "interval": "1h",
        "id": EventFrequencyCondition.id,
        "value": 1000,
        "comparisonType": ComparisonType.COUNT,
    }

    def test_count(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison={"interval": "1h", "value": 1000},
            condition_result=True,
        )

        self.assert_slow_cond_passes(dc, 1001)
        self.assert_slow_cond_does_not_pass(dc, 999)

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
    rule_cls = EventFrequencyCondition
    payload = {
        "interval": "1h",
        "id": EventFrequencyCondition.id,
        "value": 1000,
        "comparisonType": ComparisonType.PERCENT,
    }

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

        self.assert_slow_cond_passes(dc, [21, 10])
        self.assert_slow_cond_does_not_pass(dc, [20, 10])

    def test_dual_write_percent(self):
        self.payload.update({"comparisonType": ComparisonType.PERCENT, "comparisonInterval": "1d"})
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


class EventFrequencyQueryTest(EventFrequencyQueryTestBase):
    handler = EventFrequencyCountHandler

    def test_batch_query(self):
        batch_query = self.handler().batch_query(
            group_ids={self.event.group_id, self.event2.group_id, self.perf_event.group_id},
            start=self.start,
            end=self.end,
            environment_id=self.environment.id,
        )
        assert batch_query == {
            self.event.group_id: 1,
            self.event2.group_id: 1,
            self.perf_event.group_id: 1,
        }

        batch_query = self.handler().batch_query(
            group_ids={self.event3.group_id},
            start=self.start,
            end=self.end,
            environment_id=self.environment2.id,
        )
        assert batch_query == {self.event3.group_id: 1}

    def test_get_error_and_generic_group_ids(self):
        groups = Group.objects.filter(
            id__in=[self.event.group_id, self.event2.group_id, self.perf_event.group_id]
        ).values("id", "type", "project_id", "project__organization_id")
        category_group_ids = self.handler().get_group_ids_by_category(groups)
        error_group_ids = category_group_ids[GroupCategory.ERROR]
        assert self.event.group_id in error_group_ids
        assert self.event2.group_id in error_group_ids
        assert self.perf_event.group_id in category_group_ids[GroupCategory.PERFORMANCE]
