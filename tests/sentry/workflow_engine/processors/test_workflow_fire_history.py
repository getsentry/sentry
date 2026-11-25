from uuid import uuid4

import pytest
from django.utils import timezone

from sentry.models.activity import Activity
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action, WorkflowFireHistory
from sentry.workflow_engine.processors.workflow_fire_history import create_workflow_fire_histories
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest, OrganizationEvent


class TestWorkflowFireHistory(BaseWorkflowTest):
    def setUp(self) -> None:
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        self.action_group, self.action = self.create_workflow_action(workflow=self.workflow)

        self.group, self.event, self.group_event = self.create_group_event(
            occurrence=self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        )
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)

    def test_create_workflow_fire_histories(self) -> None:
        create_workflow_fire_histories(
            Action.objects.filter(id=self.action.id),
            self.event_data,
            is_delayed=False,
        )
        assert (
            WorkflowFireHistory.objects.filter(
                detector=None,
                workflow=self.workflow,
                group=self.group,
                event_id=self.group_event.event_id,
            ).count()
            == 1
        )

    def test_activity_source_identity(self) -> None:
        activity = Activity(
            project=self.project, group=self.group, type=ActivityType.SET_RESOLVED.value
        )
        activity.save()
        event_data = WorkflowEventData(
            event=activity, group=self.group, organization=self.organization
        )
        assert event_data.get_organization() == self.organization
        assert event_data.project_id == self.project.id
        histories = create_workflow_fire_histories(
            Action.objects.filter(id=self.action.id), event_data
        )
        assert histories[0].event_id == str(activity.id)

    def test_rejects_mismatched_organization(self) -> None:
        event_data = WorkflowEventData(
            event=self.group_event, group=self.group, organization=self.create_organization()
        )
        with pytest.raises(ValueError, match="same organization"):
            event_data.get_organization()

    def test_organization_history_identity_and_isolation(self) -> None:
        source = OrganizationEvent(organization_id=self.organization.id, event_id=uuid4())
        event_data = WorkflowEventData(event=source, organization=self.organization)
        # Even a shared action must not record histories for another organization.
        other_workflow = self.create_workflow(organization=self.create_organization())
        self.create_workflow_action(other_workflow, action=self.action)
        histories = create_workflow_fire_histories(
            Action.objects.filter(id=self.action.id), event_data, start_timestamp=timezone.now()
        )
        assert len(histories) == 1
        history = WorkflowFireHistory.objects.get(id=histories[0].id)
        assert history.workflow_id == self.workflow.id
        assert history.group_id is None
        assert history.detector_id is None
        assert history.event_id == source.event_id.hex
