import pytest

from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import DetectorWorkflow


@pytest.mark.skip(reason="Already run, fails when defaulting dual write in workflow engine")
class LinkCronDetectorsToAllWorkflowsTest(TestMigrations):
    migrate_from = "0084_crons_dedupe_workflows"
    migrate_to = "0085_crons_link_detectors_to_all_workflows"
    app = "workflow_engine"

    def setup_initial_state(self) -> None:
        # Create organizations and projects
        self.org1 = self.create_organization(name="org1")
        self.org2 = self.create_organization(name="org2")

        self.project1 = self.create_project(organization=self.org1)
        self.project1b = self.create_project(organization=self.org1)  # Another project in same org
        self.project2 = self.create_project(organization=self.org2)

        # Create workflows for project1
        self.project1_rule1 = self.create_project_rule(project=self.project1)
        self.project1_workflow1 = IssueAlertMigrator(self.project1_rule1).run()

        self.project1_rule2 = self.create_project_rule(project=self.project1)
        self.project1_workflow2 = IssueAlertMigrator(self.project1_rule2).run()

        # Create a workflow for project1b (same org, different project)
        self.project1b_rule1 = self.create_project_rule(project=self.project1b)
        self.project1b_workflow1 = IssueAlertMigrator(self.project1b_rule1).run()

        # Create a workflow in org2/project2
        self.project2_rule1 = self.create_project_rule(project=self.project2)
        self.project2_workflow1 = IssueAlertMigrator(self.project2_rule1).run()

        # Create cron detectors (type="monitor_check_in_failure") for project1
        self.cron_detector1 = self.create_detector(
            project=self.project1, name="cron-detector-1", type="monitor_check_in_failure"
        )

        self.cron_detector2 = self.create_detector(
            project=self.project1, name="cron-detector-2", type="monitor_check_in_failure"
        )

        # Create a cron detector for project1b (different project, same org)
        self.cron_detector3 = self.create_detector(
            project=self.project1b, name="cron-detector-3", type="monitor_check_in_failure"
        )

        # Create a cron detector in org2/project2
        self.cron_detector4 = self.create_detector(
            project=self.project2, name="cron-detector-4", type="monitor_check_in_failure"
        )

        # Create non-cron detectors (should not be affected)
        self.regular_detector1 = self.create_detector(
            project=self.project1, name="regular-detector-1", type="error"  # Not a cron detector
        )

        self.regular_detector2 = self.create_detector(
            project=self.project2, name="regular-detector-2", type="error"  # Not a cron detector
        )

        # Create some existing DetectorWorkflow entries to ensure we don't duplicate
        # Link cron_detector1 to project1_workflow1 (this should not be duplicated)
        DetectorWorkflow.objects.create(
            detector=self.cron_detector1, workflow=self.project1_workflow1
        )

        # Link regular_detector1 to project1_workflow1 (should be preserved but not affect cron linking)
        DetectorWorkflow.objects.create(
            detector=self.regular_detector1, workflow=self.project1_workflow1
        )

    def test_migration(self) -> None:
        # Verify project1 cron detectors are linked to all project1 workflows only
        project1_workflows = [self.project1_workflow1, self.project1_workflow2]
        project1_cron_detectors = [self.cron_detector1, self.cron_detector2]

        for detector in project1_cron_detectors:
            detector_workflows = DetectorWorkflow.objects.filter(detector=detector)
            assert detector_workflows.count() == len(project1_workflows), (
                f"Cron detector {detector.name} should be linked to all {len(project1_workflows)} "
                f"workflows in project1, but found {detector_workflows.count()}"
            )

            linked_workflow_ids = set(detector_workflows.values_list("workflow_id", flat=True))
            expected_workflow_ids = {w.id for w in project1_workflows}
            assert linked_workflow_ids == expected_workflow_ids, (
                f"Cron detector {detector.name} should be linked to workflows "
                f"{expected_workflow_ids}, but found {linked_workflow_ids}"
            )

        # Verify project1b cron detector is linked to project1b workflow only
        project1b_detector_workflows = DetectorWorkflow.objects.filter(detector=self.cron_detector3)
        assert project1b_detector_workflows.count() == 1, (
            f"Project1b cron detector should be linked to 1 workflow, "
            f"but found {project1b_detector_workflows.count()}"
        )
        project1b_detector_workflows_first = project1b_detector_workflows.first()
        assert project1b_detector_workflows_first
        assert (
            project1b_detector_workflows_first.workflow_id == self.project1b_workflow1.id
        ), "Project1b cron detector should be linked to project1b workflow only"

        # Verify project2 cron detector is linked to project2 workflow only
        project2_detector_workflows = DetectorWorkflow.objects.filter(detector=self.cron_detector4)
        assert project2_detector_workflows.count() == 1, (
            f"Project2 cron detector should be linked to 1 workflow, "
            f"but found {project2_detector_workflows.count()}"
        )
        project2_detector_workflows_first = project2_detector_workflows.first()
        assert project2_detector_workflows_first
        assert (
            project2_detector_workflows_first.workflow_id == self.project2_workflow1.id
        ), "Project2 cron detector should be linked to project2 workflow"

        # Verify cron detectors are NOT linked to workflows from other projects in same org
        # cron_detector1 and cron_detector2 should NOT be linked to project1b_workflow1
        for detector in project1_cron_detectors:
            wrong_project_links = DetectorWorkflow.objects.filter(
                detector=detector, workflow=self.project1b_workflow1
            )
            assert wrong_project_links.count() == 0, (
                f"Cron detector {detector.name} from project1 should NOT be linked to "
                f"project1b workflow, but found {wrong_project_links.count()} links"
            )

        # Verify regular detectors are not linked to all workflows
        regular_detector1_workflows = DetectorWorkflow.objects.filter(
            detector=self.regular_detector1
        )
        assert regular_detector1_workflows.count() == 1, (
            f"Regular detector should still have only 1 workflow link, "
            f"but found {regular_detector1_workflows.count()}"
        )

        regular_detector2_workflows = DetectorWorkflow.objects.filter(
            detector=self.regular_detector2
        )
        assert regular_detector2_workflows.count() == 0, (
            f"Regular detector2 should have no workflow links, "
            f"but found {regular_detector2_workflows.count()}"
        )

        # Verify no duplicate DetectorWorkflow entries were created
        # cron_detector1 already had a link to project1_workflow1, should still be just 1
        detector1_workflow1_links = DetectorWorkflow.objects.filter(
            detector=self.cron_detector1, workflow=self.project1_workflow1
        )
        assert (
            detector1_workflow1_links.count() == 1
        ), "Should not create duplicate DetectorWorkflow entries"

        # Verify total counts
        total_cron_detector_workflows = DetectorWorkflow.objects.filter(
            detector__type="monitor_check_in_failure"
        ).count()
        expected_total = (
            len(project1_cron_detectors)
            * len(project1_workflows)  # project1: 2 detectors * 2 workflows = 4
            + 1  # project1b: 1 detector * 1 workflow = 1
            + 1  # project2: 1 detector * 1 workflow = 1
        )
        assert total_cron_detector_workflows == expected_total, (
            f"Expected {expected_total} total cron DetectorWorkflow entries, "
            f"but found {total_cron_detector_workflows}"
        )
