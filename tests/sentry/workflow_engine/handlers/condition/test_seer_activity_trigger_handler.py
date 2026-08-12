import pytest
from jsonschema import ValidationError

from sentry.types.activity import ActivityType
from sentry.workflow_engine.handlers.condition.seer_activity_trigger_handler import (
    SeerActivityTriggerStage,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestSeerActivityTriggerHandler(ConditionTestCase):
    condition = Condition.SEER_ACTIVITY_TRIGGER

    def setUp(self) -> None:
        super().setUp()
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison=[SeerActivityTriggerStage.RCA_COMPLETED],
            condition_result=True,
        )

    def _create_event_data(self, activity_type: ActivityType) -> WorkflowEventData:
        activity = self.create_group_activity(group=self.group, type=activity_type.value)
        return WorkflowEventData(event=activity, group=self.group)

    def test_evaluate_value__matching_single_stage(self) -> None:
        event_data = self._create_event_data(ActivityType.SEER_RCA_COMPLETED)
        self.assert_passes(self.dc, event_data)

    def test_evaluate_value__non_matching_stage(self) -> None:
        event_data = self._create_event_data(ActivityType.SEER_PR_CREATED)
        self.assert_does_not_pass(self.dc, event_data)

    def test_evaluate_value__matching_multiple_stages(self) -> None:
        self.dc.update(
            comparison=[
                SeerActivityTriggerStage.RCA_COMPLETED,
                SeerActivityTriggerStage.CODING_COMPLETED,
            ]
        )

        event_data = self._create_event_data(ActivityType.SEER_CODING_COMPLETED)
        self.assert_passes(self.dc, event_data)

    def test_evaluate_value__all_stages(self) -> None:
        self.dc.update(comparison=[stage.value for stage in SeerActivityTriggerStage])

        for stage, activity_type_value in [
            (SeerActivityTriggerStage.RCA_COMPLETED, ActivityType.SEER_RCA_COMPLETED),
            (SeerActivityTriggerStage.SOLUTION_COMPLETED, ActivityType.SEER_SOLUTION_COMPLETED),
            (SeerActivityTriggerStage.CODING_COMPLETED, ActivityType.SEER_CODING_COMPLETED),
            (SeerActivityTriggerStage.PR_CREATED, ActivityType.SEER_PR_CREATED),
        ]:
            event_data = self._create_event_data(activity_type_value)
            self.assert_passes(self.dc, event_data)

    def test_evaluate_value__unrelated_activity_type(self) -> None:
        event_data = self._create_event_data(ActivityType.SET_RESOLVED)
        self.assert_does_not_pass(self.dc, event_data)

    def test_evaluate_value__non_activity_event(self) -> None:
        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        self.assert_does_not_pass(self.dc, event_data)

    def test_evaluate_value__stale_removed_stage_in_db(self) -> None:
        self.dc.update(comparison=["rca_started", SeerActivityTriggerStage.RCA_COMPLETED])

        event_data = self._create_event_data(ActivityType.SEER_RCA_COMPLETED)
        self.assert_passes(self.dc, event_data)

        event_data = self._create_event_data(ActivityType.SEER_RCA_STARTED)
        self.assert_does_not_pass(self.dc, event_data)

    def test_json_schema__valid_single_stage(self) -> None:
        self.dc.comparison = [SeerActivityTriggerStage.PR_CREATED]
        self.dc.save()

    def test_json_schema__valid_multiple_stages(self) -> None:
        self.dc.comparison = [
            SeerActivityTriggerStage.RCA_COMPLETED,
            SeerActivityTriggerStage.CODING_COMPLETED,
            SeerActivityTriggerStage.PR_CREATED,
        ]
        self.dc.save()

    def test_json_schema__empty_array(self) -> None:
        self.dc.comparison = []
        with pytest.raises(ValidationError):
            self.dc.save()

    def test_json_schema__invalid_stage_string(self) -> None:
        self.dc.comparison = ["invalid_stage"]
        with pytest.raises(ValidationError):
            self.dc.save()
