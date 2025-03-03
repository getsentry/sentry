from datetime import timedelta

from django.utils import timezone

from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.action_group_status import ActionGroupStatus
from sentry.workflow_engine.processors.action import filter_recently_fired_workflow_actions
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


@freeze_time("2024-01-09")
class TestFilterRecentlyFiredWorkflowActions(BaseWorkflowTest):
    def setUp(self):
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
        self.job = WorkflowJob({"event": self.group_event})

    def test(self):
        # test default frequency when no workflow.config set
        status_1 = ActionGroupStatus.objects.create(action=self.action, group=self.group)
        status_1.update(date_updated=timezone.now() - timedelta(days=1))

        _, action = self.create_workflow_action(workflow=self.workflow)
        status_2 = ActionGroupStatus.objects.create(action=action, group=self.group)

        triggered_actions = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.group
        )
        assert set(triggered_actions) == {self.action}

        for status in [status_1, status_2]:
            status.refresh_from_db()
            assert status.date_updated == timezone.now()

    def test_multiple_workflows(self):
        status_1 = ActionGroupStatus.objects.create(action=self.action, group=self.group)
        status_1.update(date_updated=timezone.now() - timedelta(hours=1))

        workflow = self.create_workflow(organization=self.organization, config={"frequency": 1440})
        self.create_detector_workflow(detector=self.detector, workflow=workflow)
        _, action_2 = self.create_workflow_action(workflow=workflow)
        status_2 = ActionGroupStatus.objects.create(action=action_2, group=self.group)

        _, action_3 = self.create_workflow_action(workflow=workflow)
        status_3 = ActionGroupStatus.objects.create(action=action_3, group=self.group)
        status_3.update(date_updated=timezone.now() - timedelta(days=2))

        triggered_actions = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.group
        )
        assert set(triggered_actions) == {self.action, action_3}

        for status in [status_1, status_2, status_3]:
            status.refresh_from_db()
            assert status.date_updated == timezone.now()
