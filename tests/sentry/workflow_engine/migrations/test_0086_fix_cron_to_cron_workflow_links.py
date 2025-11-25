import pytest

from sentry.models.rule import Rule, RuleSource
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import (
    AlertRuleWorkflow,
    DataSource,
    DataSourceDetector,
    DetectorWorkflow,
)


@pytest.mark.skip
class FixCronToCronWorkflowLinksTest(TestMigrations):
    migrate_from = "0085_crons_link_detectors_to_all_workflows"
    migrate_to = "0086_fix_cron_to_cron_workflow_links"
    app = "workflow_engine"

    def _create_cron_rule_with_workflow(
        self,
        project,
        monitor_slug,
        frequency=5,
    ):
        rule = self.create_project_rule(
            project=project,
            action_data=[
                {
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": 12345,
                    "targetType": "Team",
                }
            ],
            condition_data=[
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                {
                    "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                    "key": "monitor.slug",
                    "match": "eq",
                    "value": monitor_slug,
                },
            ],
            frequency=frequency,
        )
        workflow = IssueAlertMigrator(rule).run()
        Rule.objects.filter(id=rule.id).update(source=RuleSource.CRON_MONITOR)
        return rule, workflow

    def _create_monitor_with_detector(self, org, project, rule, name):
        """Helper to create monitor with detector and data source"""
        monitor = self.create_monitor(
            organization=org,
            project=project,
            name=name,
        )
        monitor.config["alert_rule_id"] = rule.id
        monitor.save()

        detector = self.create_detector(
            project=project,
            name=f"detector-{name}",
            type="monitor_check_in_failure",
        )

        data_source = DataSource.objects.create(
            organization_id=org.id,
            type="cron_monitor",
            source_id=str(monitor.id),
        )

        DataSourceDetector.objects.create(
            data_source=data_source,
            detector=detector,
        )

        return monitor, detector

    def _create_monitor_with_detector_no_alert_rule(self, org, project, name):
        """Helper to create monitor with detector but no alert_rule_id"""
        monitor = self.create_monitor(
            organization=org,
            project=project,
            name=name,
        )
        detector = self.create_detector(
            project=project,
            name=f"detector-{name}",
            type="monitor_check_in_failure",
        )

        data_source = DataSource.objects.create(
            organization_id=org.id,
            type="cron_monitor",
            source_id=str(monitor.id),
        )

        DataSourceDetector.objects.create(
            data_source=data_source,
            detector=detector,
        )

        return monitor, detector

    def setup_initial_state(self) -> None:
        # Create organization and project
        self.org = self.create_organization(name="test-org")
        self.project = self.create_project(organization=self.org)

        # === Create Issue Alert Workflows (source=0) ===
        # These will be unlinked from cron detectors by this migration
        self.issue_rule1 = self.create_project_rule(project=self.project)
        self.issue_workflow1 = IssueAlertMigrator(self.issue_rule1).run()
        Rule.objects.filter(id=self.issue_rule1.id).update(source=RuleSource.ISSUE)

        self.issue_rule2 = self.create_project_rule(project=self.project)
        self.issue_workflow2 = IssueAlertMigrator(self.issue_rule2).run()
        Rule.objects.filter(id=self.issue_rule2.id).update(source=RuleSource.ISSUE)

        # === Create Cron Monitor Workflows (source=1) ===
        # Scenario 1: Two monitors with identical rules (deduped in 0084)
        self.cron_rule1, self.cron_workflow1 = self._create_cron_rule_with_workflow(
            project=self.project,
            monitor_slug="monitor-1",
            frequency=5,
        )

        self.cron_rule2, self.cron_workflow2 = self._create_cron_rule_with_workflow(
            project=self.project,
            monitor_slug="monitor-2",
            frequency=5,
        )

        # Simulate deduplication from migration 0084: delete workflow2, point rule2 to workflow1
        self.cron_workflow2.delete()
        AlertRuleWorkflow.objects.filter(rule_id=self.cron_rule2.id).delete()
        AlertRuleWorkflow.objects.create(rule_id=self.cron_rule2.id, workflow=self.cron_workflow1)

        # Scenario 2: Monitor with unique rule (not deduped)
        self.cron_rule3, self.cron_workflow3 = self._create_cron_rule_with_workflow(
            project=self.project,
            monitor_slug="monitor-3",
            frequency=1440,  # Different frequency, so not deduped
        )

        # Scenario 3: Monitor with its own workflow (for testing cross-linking)
        self.cron_rule4, self.cron_workflow4 = self._create_cron_rule_with_workflow(
            project=self.project,
            monitor_slug="monitor-4",
            frequency=60,  # Different frequency
        )

        # === Create Monitors and Detectors ===
        self.monitor1, self.detector1 = self._create_monitor_with_detector(
            self.org, self.project, self.cron_rule1, "monitor-1"
        )

        self.monitor2, self.detector2 = self._create_monitor_with_detector(
            self.org, self.project, self.cron_rule2, "monitor-2"
        )

        self.monitor3, self.detector3 = self._create_monitor_with_detector(
            self.org, self.project, self.cron_rule3, "monitor-3"
        )

        self.monitor4, self.detector4 = self._create_monitor_with_detector(
            self.org, self.project, self.cron_rule4, "monitor-4"
        )

        # Scenario 4: Monitor without alert_rule_id (no cron workflow)
        self.monitor5, self.detector5 = self._create_monitor_with_detector_no_alert_rule(
            self.org, self.project, "monitor-5-no-rule"
        )

        # Scenario 5: Monitor with alert_rule_id but no workflow (error case)
        # Create a rule but don't create a workflow for it
        self.orphan_rule = self.create_project_rule(
            project=self.project,
            action_data=[
                {
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": 12345,
                    "targetType": "Team",
                }
            ],
            condition_data=[
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                {
                    "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                    "key": "monitor.slug",
                    "match": "eq",
                    "value": "monitor-orphan",
                },
            ],
            frequency=999,  # Unique frequency so this has a unique hash
        )
        Rule.objects.filter(id=self.orphan_rule.id).update(source=RuleSource.CRON_MONITOR)
        # Don't create a workflow for this rule - simulates an error state

        self.monitor_orphan, self.detector_orphan = self._create_monitor_with_detector(
            self.org, self.project, self.orphan_rule, "monitor-orphan"
        )

        # Scenario 6: Monitor with rule that should share deduped workflow but doesn't have one
        # Create a rule with same config as cron_rule1/cron_rule2 but NO workflow
        self.cron_rule6 = self.create_project_rule(
            project=self.project,
            action_data=[
                {
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": 12345,
                    "targetType": "Team",
                }
            ],
            condition_data=[
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                {
                    "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                    "key": "monitor.slug",
                    "match": "eq",
                    "value": "monitor-6",
                },
            ],
            frequency=5,  # Same frequency as monitor1 and monitor2
        )
        Rule.objects.filter(id=self.cron_rule6.id).update(source=RuleSource.CRON_MONITOR)
        # NO workflow created for rule6 (simulating dedupe from 0084)

        self.monitor6, self.detector6 = self._create_monitor_with_detector(
            self.org, self.project, self.cron_rule6, "monitor-6"
        )

        # Scenario 7: Monitor without alert_rule_id in a DIFFERENT org with NO cron rules
        # This tests that unlink_monitors_without_alert_rules processes ALL orgs
        self.org2 = self.create_organization(name="test-org-no-cron-rules")
        self.project2 = self.create_project(organization=self.org2)

        self.monitor7, self.detector7 = self._create_monitor_with_detector_no_alert_rule(
            self.org2, self.project2, "monitor-7-no-rule-diff-org"
        )

        # === Simulate the over-linking from migration 0085 ===
        # Migration 0085 linked ALL cron detectors to ALL workflows in the project
        all_cron_detectors = [
            self.detector1,
            self.detector2,
            self.detector3,
            self.detector4,
            self.detector5,
            self.detector_orphan,
            self.detector6,
            self.detector7,  # Added detector in org with no cron rules
        ]
        all_workflows = [
            self.issue_workflow1,
            self.issue_workflow2,
            self.cron_workflow1,
            # workflow2 was deleted in deduplication
            self.cron_workflow3,
            self.cron_workflow4,
        ]

        for detector in all_cron_detectors[:-1]:  # All except detector7
            for workflow in all_workflows:
                DetectorWorkflow.objects.get_or_create(
                    detector=detector,
                    workflow=workflow,
                )

        # For detector7 in org2, create and link to workflows in that org
        rule_org2 = self.create_project_rule(project=self.project2)
        self.issue_workflow_org2 = IssueAlertMigrator(rule_org2).run()
        Rule.objects.filter(id=rule_org2.id).update(source=RuleSource.ISSUE)

        # Link detector7 to org2's workflow (simulating over-linking)
        DetectorWorkflow.objects.create(
            detector=self.detector7,
            workflow=self.issue_workflow_org2,
        )

    def test_migration(self) -> None:
        # This tests both the unlink_monitors_without_alert_rules and the main migration logic
        # === Test detector1 and detector2 (deduped monitors) ===
        # Both should ONLY be linked to cron_workflow1 (their deduped workflow)

        detector1_workflows = DetectorWorkflow.objects.filter(detector=self.detector1)
        detector1_workflow_ids = set(detector1_workflows.values_list("workflow_id", flat=True))

        # Should have ONLY: cron_workflow1
        # Should NOT have: issue workflows or other cron workflows
        expected_detector1_workflows = {
            self.cron_workflow1.id,
        }
        assert detector1_workflow_ids == expected_detector1_workflows, (
            f"detector1 should be linked ONLY to its deduped workflow, "
            f"expected {expected_detector1_workflows}, got {detector1_workflow_ids}"
        )

        detector2_workflows = DetectorWorkflow.objects.filter(detector=self.detector2)
        detector2_workflow_ids = set(detector2_workflows.values_list("workflow_id", flat=True))

        # detector2 should have same links as detector1 (they share deduped workflow)
        assert detector2_workflow_ids == expected_detector1_workflows, (
            f"detector2 should be linked to the same deduped workflow as detector1, "
            f"expected {expected_detector1_workflows}, got {detector2_workflow_ids}"
        )

        # === Test detector3 (unique monitor) ===
        # Should ONLY be linked to cron_workflow3
        detector3_workflows = DetectorWorkflow.objects.filter(detector=self.detector3)
        detector3_workflow_ids = set(detector3_workflows.values_list("workflow_id", flat=True))

        expected_detector3_workflows = {
            self.cron_workflow3.id,
        }
        assert detector3_workflow_ids == expected_detector3_workflows, (
            f"detector3 should be linked ONLY to its own workflow, "
            f"expected {expected_detector3_workflows}, got {detector3_workflow_ids}"
        )

        # === Test detector4 (another unique monitor) ===
        detector4_workflows = DetectorWorkflow.objects.filter(detector=self.detector4)
        detector4_workflow_ids = set(detector4_workflows.values_list("workflow_id", flat=True))

        expected_detector4_workflows = {
            self.cron_workflow4.id,
        }
        assert detector4_workflow_ids == expected_detector4_workflows, (
            f"detector4 should be linked ONLY to its own workflow, "
            f"expected {expected_detector4_workflows}, got {detector4_workflow_ids}"
        )

        # === Test detector5 (monitor without alert_rule_id) ===
        # Should have NO workflow links at all
        detector5_workflows = DetectorWorkflow.objects.filter(detector=self.detector5)
        detector5_workflow_ids = set(detector5_workflows.values_list("workflow_id", flat=True))

        assert not detector5_workflow_ids, (
            f"detector5 (no alert_rule_id) should have no workflow links, "
            f"got {detector5_workflow_ids}"
        )

        # === Test detector_orphan (monitor with alert_rule_id but no workflow) ===
        # Should keep ALL existing workflow links (error case - we don't delete when uncertain)
        detector_orphan_workflows = DetectorWorkflow.objects.filter(detector=self.detector_orphan)
        detector_orphan_workflow_ids = set(
            detector_orphan_workflows.values_list("workflow_id", flat=True)
        )

        # Should still have all the workflows from the over-linking
        expected_orphan_workflows = {
            self.issue_workflow1.id,
            self.issue_workflow2.id,
            self.cron_workflow1.id,
            self.cron_workflow3.id,
            self.cron_workflow4.id,
        }
        assert detector_orphan_workflow_ids == expected_orphan_workflows, (
            f"detector_orphan (rule without workflow) should keep all existing links, "
            f"expected {expected_orphan_workflows}, got {detector_orphan_workflow_ids}"
        )

        # === Verify no detector is linked to another monitor's cron workflow ===
        # detector1 and detector2 should NOT be linked to workflow3 or workflow4
        assert (
            self.cron_workflow3.id not in detector1_workflow_ids
        ), "detector1 should not be linked to monitor3's workflow"
        assert (
            self.cron_workflow4.id not in detector1_workflow_ids
        ), "detector1 should not be linked to monitor4's workflow"

        # detector3 should NOT be linked to workflow1 or workflow4
        assert (
            self.cron_workflow1.id not in detector3_workflow_ids
        ), "detector3 should not be linked to monitor1/2's deduped workflow"
        assert (
            self.cron_workflow4.id not in detector3_workflow_ids
        ), "detector3 should not be linked to monitor4's workflow"

        # detector4 should NOT be linked to workflow1 or workflow3
        assert (
            self.cron_workflow1.id not in detector4_workflow_ids
        ), "detector4 should not be linked to monitor1/2's deduped workflow"
        assert (
            self.cron_workflow3.id not in detector4_workflow_ids
        ), "detector4 should not be linked to monitor3's workflow"

        # === Test detector6 (rule without workflow but same hash as monitor1/2) ===
        # Should be linked ONLY to cron_workflow1 (the primary workflow of its dedupe group)
        detector6_workflows = DetectorWorkflow.objects.filter(detector=self.detector6)
        detector6_workflow_ids = set(detector6_workflows.values_list("workflow_id", flat=True))

        expected_detector6_workflows = {
            self.cron_workflow1.id,  # Should get the primary workflow from the dedupe group
        }
        assert detector6_workflow_ids == expected_detector6_workflows, (
            f"detector6 (rule without workflow) should be linked to primary workflow of dedupe group, "
            f"expected {expected_detector6_workflows}, got {detector6_workflow_ids}"
        )

        # === Test detector7 (monitor without alert_rule_id in org with NO cron rules) ===
        # Should have NO workflow links after migration
        # This tests that unlink_monitors_without_alert_rules processes ALL orgs
        detector7_workflows = DetectorWorkflow.objects.filter(detector=self.detector7)
        detector7_workflow_ids = set(detector7_workflows.values_list("workflow_id", flat=True))

        assert not detector7_workflow_ids, (
            f"detector7 (no alert_rule_id in org with no cron rules) should have no workflow links, "
            f"got {detector7_workflow_ids}"
        )
