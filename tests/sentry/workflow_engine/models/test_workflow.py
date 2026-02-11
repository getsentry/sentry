import pytest
from django.core.exceptions import ValidationError

from sentry.constants import ObjectStatus
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class WorkflowTest(BaseWorkflowTest):
    def setUp(self) -> None:
        self.workflow, self.detector, self.detector_workflow, self.data_condition_group = (
            self.create_detector_and_workflow()
        )
        self.data_condition = self.data_condition_group.conditions.first()
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)

    def test_queryset(self) -> None:
        """
        Test that we filter out objects with statuses other than 'active'
        """
        assert Workflow.objects.filter(id=self.workflow.id).exists()
        self.workflow.status = ObjectStatus.PENDING_DELETION
        self.workflow.save()
        assert not Workflow.objects.filter(id=self.workflow.id).exists()

        self.workflow.status = ObjectStatus.DELETION_IN_PROGRESS
        self.workflow.save()
        assert not Workflow.objects.filter(id=self.workflow.id).exists()

    def test_evaluate_trigger_conditions__condition_new_event__True(self) -> None:
        evaluation, _ = self.workflow.evaluate_trigger_conditions(self.event_data)
        assert evaluation.triggered is True

    def test_evaluate_trigger_conditions__condition_new_event__False(self) -> None:
        # Update event to have been seen before
        self.group_event.group.times_seen = 5

        evaluation, _ = self.workflow.evaluate_trigger_conditions(self.event_data)
        assert evaluation.triggered is False

    def test_evaluate_trigger_conditions__no_conditions(self) -> None:
        self.workflow.when_condition_group = None
        self.workflow.save()

        evaluation, _ = self.workflow.evaluate_trigger_conditions(self.event_data)
        assert evaluation.triggered is True

    def test_evaluate_trigger_conditions__slow_condition(self) -> None:
        # Update group to _all_, since the fast condition is met
        self.data_condition_group.update(logic_type="all")

        slow_condition = self.create_data_condition(
            type=Condition.EVENT_FREQUENCY_COUNT, comparison={"interval": "1d", "value": 7}
        )
        self.data_condition_group.conditions.add(slow_condition)
        evaluation, remaining_conditions = self.workflow.evaluate_trigger_conditions(
            self.event_data
        )

        assert evaluation.triggered is True
        assert remaining_conditions == [slow_condition]

    def test_full_clean__success(self) -> None:
        self.create_workflow(
            organization_id=self.organization.id,
            name="test",
            environment_id=None,
            when_condition_group=self.create_data_condition_group(),
            created_by_id=None,
            owner_user_id=None,
            owner_team=None,
            config={"frequency": 5},
        )

        workflow2 = Workflow(
            organization_id=self.organization.id,
            name="test2",
            environment_id=None,
            when_condition_group=self.create_data_condition_group(),
            created_by_id=None,
            owner_user_id=None,
            owner_team=None,
            config={"frequency": 5},
        )
        workflow2.full_clean()

    def test_full_clean__fail(self) -> None:
        workflow2 = Workflow(
            organization_id=self.organization.id,
            name="test2",
            environment_id=None,
            when_condition_group=self.create_data_condition_group(),
            created_by_id=self.user.id,
            owner_user_id=None,
            owner_team=None,
            config={"frequency": 5},
        )
        self.organization.delete()

        with pytest.raises(ValidationError):
            workflow2.full_clean()

    def test_duplicate_name(self) -> None:
        name = "my-dupe-name"
        self.create_workflow(
            organization_id=self.organization.id,
            name=name,
            environment_id=None,
            when_condition_group=self.create_data_condition_group(),
            created_by_id=None,
            owner_user_id=None,
            owner_team=None,
            config={"frequency": 30},
        )
        self.create_workflow(
            organization_id=self.organization.id,
            name=name,
            environment_id=None,
            when_condition_group=self.create_data_condition_group(),
            created_by_id=None,
            owner_user_id=None,
            owner_team=None,
            config={"frequency": 5},
        )
        assert Workflow.objects.filter(name=name).count() == 2
