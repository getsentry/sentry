from unittest.mock import patch

import pytest
from jsonschema import ValidationError

from sentry.issues.grouptype import GroupCategory, PerformanceNPlusOneGroupType
from sentry.rules.filters.issue_category import IssueCategoryFilter
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestIssueCategoryCondition(ConditionTestCase):
    condition = Condition.ISSUE_CATEGORY
    payload = {
        "id": IssueCategoryFilter.id,
        "value": "1",
    }

    def setUp(self):
        super().setUp()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group_event.group)
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "value": 1,
            },
            condition_result=True,
        )

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "value": 1,
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_json_schema(self):
        self.dc.comparison.update({"value": 2})
        self.dc.save()

        self.dc.comparison.update({"value": "asdf"})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison = {}
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"hello": "there"})
        with pytest.raises(ValidationError):
            self.dc.save()

    def test_valid_input_values(self):
        self.dc.update(comparison={"value": 1})
        self.assert_passes(self.dc, self.event_data)
        self.dc.update(comparison={"value": str(GroupCategory.ERROR.value)})
        self.assert_passes(self.dc, self.event_data)
        self.dc.update(comparison={"value": GroupCategory.ERROR.value})
        self.assert_passes(self.dc, self.event_data)

    def test_fail_on_invalid_data(self):
        data_cases = [
            {"value": None},
            {},
            {"value": GroupCategory.ERROR.name},
            {"value": "ERROR"},
            {"value": "error"},
        ]

        for data_case in data_cases:
            self.dc.update(comparison=data_case)
            self.assert_does_not_pass(self.dc, self.event_data)

    def test_group_event(self):
        assert self.event.group is not None
        group_event = self.event.for_group(self.group)

        self.dc.update(comparison={"value": GroupCategory.ERROR.value})
        self.assert_passes(self.dc, WorkflowEventData(event=self.event, group=self.group))
        self.assert_passes(self.dc, WorkflowEventData(event=group_event, group=self.group))

    @patch("sentry.issues.grouptype.GroupTypeRegistry.get_by_type_id")
    def test_invalid_issue_category(self, mock_get_by_type_id):
        mock_get_by_type_id.side_effect = ValueError("Invalid group type")

        self.assert_does_not_pass(
            self.dc, WorkflowEventData(event=self.event, group=self.event.group)
        )

    def test_category_v2(self):
        perf_group, perf_event, perf_group_event = self.create_group_event(
            group_type_id=PerformanceNPlusOneGroupType.type_id
        )

        # N+1 DB query issue should pass for 'PERFORMANCE' (deprecated) as well as 'DB_QUERY' (category_v2)
        self.dc.update(comparison={"value": GroupCategory.PERFORMANCE.value})
        self.assert_passes(self.dc, WorkflowEventData(event=perf_group_event, group=perf_group))

        self.dc.update(comparison={"value": GroupCategory.DB_QUERY.value})
        self.assert_passes(self.dc, WorkflowEventData(event=perf_group_event, group=perf_group))
