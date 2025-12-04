import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip
class DeleteNonSingleWrittenFireHistoryTest(TestMigrations):
    migrate_from = "0095_unique_detectorgroup_group"
    migrate_to = "0096_delete_non_single_written_fire_history"
    app = "workflow_engine"

    def setup_initial_state(self) -> None:
        self.org = self.create_organization(name="test-org")
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)

        # Use historical model state from the apps registry
        Detector = self.apps.get_model("workflow_engine", "Detector")
        Workflow = self.apps.get_model("workflow_engine", "Workflow")
        WorkflowFireHistory = self.apps.get_model("workflow_engine", "WorkflowFireHistory")

        self.detector = Detector.objects.create(
            project=self.project,
            name="Test Detector",
            type="error",
            config={},
        )

        self.workflow = Workflow.objects.create(
            organization=self.org,
            name="Test Workflow",
            config={},
        )

        # Create fire history records that should be deleted (is_single_written=False)
        self.fire_history_to_delete_1 = WorkflowFireHistory.objects.create(
            detector=self.detector,
            workflow=self.workflow,
            group=self.group,
            event_id="event1",
            is_single_written=False,
        )

        self.fire_history_to_delete_2 = WorkflowFireHistory.objects.create(
            detector=self.detector,
            workflow=self.workflow,
            group=self.group,
            event_id="event2",
            is_single_written=False,
        )

        # Create fire history records that should NOT be deleted (is_single_written=True)
        self.fire_history_to_keep_1 = WorkflowFireHistory.objects.create(
            detector=self.detector,
            workflow=self.workflow,
            group=self.group,
            event_id="event3",
            is_single_written=True,
        )

        self.fire_history_to_keep_2 = WorkflowFireHistory.objects.create(
            detector=self.detector,
            workflow=self.workflow,
            group=self.group,
            event_id="event4",
            is_single_written=True,
        )

    def test_migration(self) -> None:
        # Use the current model state after migration
        from sentry.workflow_engine.models import WorkflowFireHistory

        # Verify that non-single-written records are deleted
        assert not WorkflowFireHistory.objects.filter(id=self.fire_history_to_delete_1.id).exists()
        assert not WorkflowFireHistory.objects.filter(id=self.fire_history_to_delete_2.id).exists()

        # Verify that single-written records are kept
        assert WorkflowFireHistory.objects.filter(id=self.fire_history_to_keep_1.id).exists()
        assert WorkflowFireHistory.objects.filter(id=self.fire_history_to_keep_2.id).exists()

        # Verify only 2 records remain (the ones that had is_single_written=True)
        remaining_records = WorkflowFireHistory.objects.all()
        assert remaining_records.count() == 2
