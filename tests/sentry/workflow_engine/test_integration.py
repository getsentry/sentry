from datetime import datetime
from typing import cast

# from unittest import mock
from uuid import uuid4

from sentry.eventstream.types import EventStreamEventType
from sentry.incidents.grouptype import MetricAlertFire

# from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.grouptype import GroupCategory
from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.tasks.post_process import post_process_group
from sentry.types.group import PriorityLevel
from sentry.utils.dates import parse_timestamp
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestWorkflowEngineIntegration(BaseWorkflowTest):
    def create_metric_issue_workflow_occurrence(self, **kwargs):
        fingerprint = [str(self.detector.id)]
        detection_time = cast(datetime, parse_timestamp(datetime.utcnow().timestamp()))

        return IssueOccurrence(
            id=uuid4().hex,
            culprit="",
            detection_time=detection_time,
            event_id=uuid4().hex,
            evidence_data={"detector_id": self.detector.id},
            evidence_display=[],
            fingerprint=fingerprint,
            initial_issue_priority=PriorityLevel.HIGH,
            issue_title="Test Metric Issue Workflow",
            level="error",
            project_id=self.project.id,
            resource_id=None,
            subtitle="Integration Test",
            type=MetricAlertFire,
            **kwargs,
        )

    def setUp(self):
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        self.action_group, self.action = self.create_workflow_action(workflow=self.workflow)
        self.group = self.create_group(
            project=self.project,
            type=GroupCategory.METRIC_ALERT.value,
        )

        self.event = self.create_event(self.project.id, datetime.utcnow(), str(self.detector.id))
        self.event.for_group(self.group)

        occurrence_data = self.build_occurrence_data(
            event_id=self.event.event_id,
            project_id=self.project.id,
            fingerprint=[str(self.detector.id)],
            evidence_data={"detector_id": self.detector.id},
            type=MetricAlertFire.type_id,
            category=GroupCategory.METRIC_ALERT.value,
        )
        self.occurrence, _ = save_issue_occurrence(occurrence_data, self.event)

    def call_post_process_group(
        self, event, is_new=True, is_regression=False, is_new_group_environment=True, cache_key=None
    ):
        # TODO - Figure out how to get this feature stuff setup correctly for this post_process group
        post_process_group(
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            cache_key=None,
            group_id=event.group_id,
            occurrence_id=self.occurrence.id,
            project_id=self.project.id,
            eventstream_type=EventStreamEventType.Generic,
        )

        return cache_key

    def test_workflow_engine__workflows(self):
        self.create_event(self.project.id, datetime.utcnow(), str(self.detector.id))

        import pdb
        pdb.set_trace()

        self.call_post_process_group(self.event)

    # TODO - Figure out how i want to connect the data_source -> detector -> Issue Platform, how to test that it would save correctly.
    def test_workflow_engine__data_source__to_metric_issue_workflow(self):
        # Figure out how to make a data_source that triggers a detector
        # Create a detector handler that will create a MetricIssueWorkflow
        pass

    # TODO - Tie test_workflow_engine__workflows to test_workflow_engine__data_source__to_metric_issue_workflow
    def test_workflow_engine(self):
        # Get the data_source to trigger a detector
        # Get the detector to create a MetricIssueWorkflow
        # Get the MetricIssueWorkflow to call post_process correctly
        # Ensure a mock action is invoked
        pass
