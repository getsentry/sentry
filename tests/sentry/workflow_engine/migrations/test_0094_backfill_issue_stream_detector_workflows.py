import pytest

from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import Detector, DetectorWorkflow


@pytest.mark.skip
class TestBackfillIssueStreamDetectorWorkflows(TestMigrations):
    migrate_from = "0093_add_action_config_index"
    migrate_to = "0094_backfill_issue_stream_detector_workflows"
    app = "workflow_engine"

    def setup_initial_state(self):
        self.test_org = self.create_organization(
            name="test-email-fix-org", slug="test-email-fix-org"
        )
        self.project1 = self.create_project(organization=self.test_org)
        self.project2 = self.create_project(organization=self.test_org)

        self.error_detector1 = self.create_detector(project=self.project1, type="error")
        self.error_detector2 = self.create_detector(project=self.project2, type="error")
        self.issue_stream_detector1 = self.create_detector(
            project=self.project1, type="issue_stream"
        )

        self.workflow1 = self.create_workflow(organization=self.test_org)
        self.detector_workflow1 = self.create_detector_workflow(
            detector=self.error_detector1, workflow=self.workflow1
        )
        self.workflow2 = self.create_workflow(organization=self.test_org)
        # workflow already connected to issue stream detector, we will try to create but should ignore conflicts
        self.create_detector_workflow(detector=self.issue_stream_detector1, workflow=self.workflow2)

        self.workflow3 = self.create_workflow(organization=self.test_org)
        self.detector_workflow2 = self.create_detector_workflow(
            detector=self.error_detector2, workflow=self.workflow3
        )
        self.workflow4 = self.create_workflow(organization=self.test_org)
        self.detector_workflow4 = self.create_detector_workflow(
            detector=self.error_detector2, workflow=self.workflow4
        )

    def test_migration(self):
        # existing issue stream detector connected to error detector workflows
        issue_stream_detector1_workflows = DetectorWorkflow.objects.filter(
            detector=self.issue_stream_detector1
        ).values_list("workflow_id", flat=True)
        assert set(issue_stream_detector1_workflows) == {self.workflow1.id, self.workflow2.id}

        # new issue stream detector created and connected to error detector workflows
        issue_stream_detector2 = Detector.objects.get(project=self.project2, type="issue_stream")
        assert issue_stream_detector2.name == "Issue Stream"
        assert issue_stream_detector2.enabled is True
        assert issue_stream_detector2.owner_user_id is None
        assert issue_stream_detector2.owner_team is None
        assert issue_stream_detector2.config == {}

        issue_stream_detector2_workflows = DetectorWorkflow.objects.filter(
            detector=issue_stream_detector2
        ).values_list("workflow_id", flat=True)
        assert set(issue_stream_detector2_workflows) == {self.workflow3.id, self.workflow4.id}
