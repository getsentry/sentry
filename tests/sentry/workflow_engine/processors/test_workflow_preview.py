from unittest.mock import patch

from sentry.grouping.grouptype import ErrorGroupType
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.workflow_preview import (
    EvaluationGroup,
    preview_condition_group,
    preview_conditions,
    preview_workflow,
)


class TestPreviewConditions(TestCase):
    def setUp(self):
        self.condition = self.create_data_condition(
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
        self.condition_2 = self.create_data_condition(
            type=Condition.REGRESSION_EVENT,
            comparison=True,
            condition_result=False,
        )
        self.conditions = [
            self.condition,
            self.condition_2,
        ]
        self.group_2 = self.create_group()
        self.group_ids = {self.group.id, self.group_2.id}

    def test_no_conditions(self):
        groups_to_check, groups_meeting_conditions = preview_conditions(
            logic_type=DataConditionGroup.Type.ALL, conditions=[], group_ids=self.group_ids
        )
        assert groups_to_check == set()
        assert groups_meeting_conditions == self.group_ids

    def test_all_type__meets_all(self):
        groups_to_check, groups_meeting_conditions = preview_conditions(
            logic_type=DataConditionGroup.Type.ALL,
            conditions=self.conditions,
            group_ids=self.group_ids,
        )
        assert groups_to_check == self.group_ids
        assert groups_meeting_conditions == self.group_ids

    @patch("sentry.workflow_engine.models.data_condition.DataCondition.get_preview_groups")
    def test_all_type__does_not_meet_all(self, mock_get_preview_groups):
        mock_get_preview_groups.side_effect = [self.group_ids, set()]
        groups_to_check, groups_meeting_conditions = preview_conditions(
            logic_type=DataConditionGroup.Type.ALL,
            conditions=self.conditions,
            group_ids=self.group_ids,
        )
        assert groups_to_check == set()
        assert groups_meeting_conditions == set()

    @patch("sentry.workflow_engine.models.data_condition.DataCondition.get_preview_groups")
    def test_any_type__meets_any(self, mock_get_preview_groups):
        mock_get_preview_groups.side_effect = [{self.group.id}, set()]
        groups_to_check, groups_meeting_conditions = preview_conditions(
            logic_type=DataConditionGroup.Type.ANY,
            conditions=self.conditions,
            group_ids=self.group_ids,
        )
        assert groups_to_check == {self.group_2.id}
        assert groups_meeting_conditions == {self.group.id}

    @patch("sentry.workflow_engine.models.data_condition.DataCondition.get_preview_groups")
    def test_any_type__does_not_meet_any(self, mock_get_preview_groups):
        mock_get_preview_groups.return_value = set()
        groups_to_check, groups_meeting_conditions = preview_conditions(
            logic_type=DataConditionGroup.Type.ANY,
            conditions=self.conditions,
            group_ids=self.group_ids,
        )
        assert groups_to_check == self.group_ids
        assert groups_meeting_conditions == set()

    @patch("sentry.workflow_engine.models.data_condition.DataCondition.get_preview_groups")
    def test_none_type__meets_none(self, mock_get_preview_groups):
        mock_get_preview_groups.return_value = set()
        groups_to_check, groups_meeting_conditions = preview_conditions(
            logic_type=DataConditionGroup.Type.NONE,
            conditions=self.conditions,
            group_ids=self.group_ids,
        )
        assert groups_to_check == self.group_ids
        assert groups_meeting_conditions == self.group_ids

    @patch("sentry.workflow_engine.models.data_condition.DataCondition.get_preview_groups")
    def test_none_type__does_not_meet_none(self, mock_get_preview_groups):
        mock_get_preview_groups.side_effect = [self.group_ids, set()]
        groups_to_check, groups_meeting_conditions = preview_conditions(
            logic_type=DataConditionGroup.Type.NONE,
            conditions=self.conditions,
            group_ids=self.group_ids,
        )
        assert groups_to_check == set()
        assert groups_meeting_conditions == set()


class TestPreviewDataConditionGroup(TestCase):
    def setUp(self):
        self.fast_condition = self.create_data_condition(
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
        self.slow_condition = self.create_data_condition(
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
            },
            condition_result=True,
        )
        self.conditions = [
            self.fast_condition,
            self.slow_condition,
        ]
        self.group_ids = {self.group.id}

    @patch("sentry.workflow_engine.processors.workflow_preview.preview_conditions")
    def test_groups_to_check(self, mock_preview_conditions):
        mock_preview_conditions.return_value = [(self.group_ids, self.group_ids), (set(), set())]

        preview_groups = preview_condition_group(
            logic_type=DataConditionGroup.Type.ALL,
            conditions=self.conditions,
            group_ids=self.group_ids,
        )
        assert preview_groups == set()

        assert mock_preview_conditions.call_count == 2

    @patch("sentry.workflow_engine.processors.workflow_preview.preview_conditions")
    def test_no_groups_to_check(self, mock_preview_conditions):
        mock_preview_conditions.return_value = (set(), self.group_ids)

        preview_groups = preview_condition_group(
            logic_type=DataConditionGroup.Type.ALL,
            conditions=self.conditions,
            group_ids=self.group_ids,
        )
        assert preview_groups == self.group_ids

        assert mock_preview_conditions.call_count == 1


class TestPreviewWorkflow(TestCase):
    def setUp(self):
        self.detector = self.create_detector(
            name="test_detector",
            type=ErrorGroupType.slug,
            project=self.project,
        )
        self.fast_condition = self.create_data_condition(
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
        self.slow_condition = self.create_data_condition(
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
            },
            condition_result=True,
        )
        self.conditions = [
            self.fast_condition,
            self.slow_condition,
        ]
        self.condition_group = EvaluationGroup(
            logic_type=DataConditionGroup.Type.ANY, conditions=self.conditions
        )
        self.group = self.create_group(project=self.project)

    def test_no_groups(self):
        self.group.delete()
        preview_groups = preview_workflow(
            detectors=[self.detector],
            environment=None,
            trigger_condition_group=self.condition_group,
            filter_condition_groups=[self.condition_group],
        )
        assert preview_groups == set()

    @patch("sentry.workflow_engine.processors.workflow_preview.preview_conditions")
    def test_meets_triggers_only(self, mock_preview_conditions):
        mock_preview_conditions.side_effect = [(set(), {self.group.id}), (set(), set())]
        preview_groups = preview_workflow(
            detectors=[self.detector],
            environment=None,
            trigger_condition_group=self.condition_group,
            filter_condition_groups=[self.condition_group],
        )
        assert preview_groups == set()

    @patch("sentry.workflow_engine.processors.workflow_preview.preview_conditions")
    def test_meets_triggers_and_filters(self, mock_preview_conditions):
        mock_preview_conditions.side_effect = [(set(), {self.group.id}), (set(), {self.group.id})]
        preview_groups = preview_workflow(
            detectors=[self.detector],
            environment=None,
            trigger_condition_group=self.condition_group,
            filter_condition_groups=[self.condition_group],
        )
        assert preview_groups == {self.group.id}
