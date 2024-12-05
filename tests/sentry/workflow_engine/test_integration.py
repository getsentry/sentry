from datetime import datetime
from typing import cast

# from unittest import mock
from uuid import uuid4

from sentry.issues.grouptype import MetricIssueWorkflow
from sentry.issues.issue_occurrence import IssueOccurrence
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
            type=MetricIssueWorkflow,
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

    def test_workflow_engine__workflows(self):
        # Figure out how to break this down to just creating a mock event and calling the correct post_process group method to trigger the workflow engine
        pass

    def test_workflow_engine__data_source__to_metric_issue_workflow(self):
        # Figure out how to make a data_source that triggers a detector
        # Create a detector handler that will create a MetricIssueWorkflow
        pass

    def test_workflow_engine(self):
        # Get the data_source to trigger a detector
        # Get the detector to create a MetricIssueWorkflow
        # Get the MetricIssueWorkflow to call post_process correctly
        # Ensure a mock action is invoked
        pass
