from datetime import datetime
from unittest import mock

from sentry.eventstream.types import EventStreamEventType
from sentry.incidents.grouptype import MetricAlertFire
from sentry.issues.ingest import save_issue_occurrence
from sentry.models.group import Group
from sentry.tasks.post_process import post_process_group
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestWorkflowEngineIntegration(BaseWorkflowTest):
    def setUp(self):
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow(name_prefix="e2e-test")

        self.action_group, self.action = self.create_workflow_action(workflow=self.workflow)

        self.event = self.store_event(data={}, project_id=self.project.id)

        occurrence_data = self.build_occurrence_data(
            event_id=self.event.event_id,
            project_id=self.project.id,
            fingerprint=[f"detector-{self.detector.id}"],
            evidence_data={"detector_id": self.detector.id},
            type=MetricAlertFire.type_id,
        )

        self.occurrence, group_info = save_issue_occurrence(occurrence_data, self.event)
        assert group_info is not None

        self.group = Group.objects.filter(grouphash__hash=self.occurrence.fingerprint[0]).first()
        assert self.group is not None
        assert self.group.type == MetricAlertFire.type_id

    def call_post_process_group(
        self,
        group_id,
        is_new=False,
        is_regression=False,
        is_new_group_environment=True,
        cache_key=None,
    ):
        post_process_group(
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            cache_key=cache_key,
            group_id=group_id,
            occurrence_id=self.occurrence.id,
            project_id=self.project.id,
            eventstream_type=EventStreamEventType.Generic,
        )

        return cache_key

    # TODO - Figure out how i want to connect the data_source -> detector -> Issue Platform, how to test that it would save correctly.
    def test_workflow_engine__data_source__to_metric_issue_workflow(self):
        """
        This test ensures that a data_source can create the correct event in Issue Platform
        """
        # Figure out how to make a data_source that triggers a detector
        # Create a detector handler that will create a MetricIssueWorkflow
        pass

    def test_workflow_engine__workflows(self):
        """
        This test ensures that the workflow engine is correctly hooked up to tasks/post_process.py.
        """
        self.create_event(self.project.id, datetime.utcnow(), str(self.detector.id))

        if not self.group:
            assert False, "Group not created"

        # Move the mock before calling post_process_group
        with mock.patch(
            "sentry.workflow_engine.processors.workflow.process_workflows"
        ) as mock_process_workflow:
            self.call_post_process_group(self.group.id)
            mock_process_workflow.assert_called_once()
