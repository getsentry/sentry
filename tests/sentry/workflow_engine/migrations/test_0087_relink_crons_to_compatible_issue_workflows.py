import pytest

from sentry.models.rule import Rule, RuleSource
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import DataSource, DataSourceDetector, DetectorWorkflow


@pytest.mark.skip
class RelinkCronsToCompatibleIssueWorkflowsTest(TestMigrations):
    migrate_from = "0086_fix_cron_to_cron_workflow_links"
    migrate_to = "0087_relink_crons_to_compatible_issue_workflows"
    app = "workflow_engine"

    def _create_issue_rule_with_workflow(
        self,
        project,
        condition_data,
        action_data=None,
        frequency=5,
    ):
        """Helper to create an issue rule with workflow."""
        if action_data is None:
            action_data = [
                {
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": 12345,
                    "targetType": "Team",
                }
            ]

        rule = self.create_project_rule(
            project=project,
            action_data=action_data,
            condition_data=condition_data,
            frequency=frequency,
        )
        workflow = IssueAlertMigrator(rule).run()
        Rule.objects.filter(id=rule.id).update(source=RuleSource.ISSUE)
        return rule, workflow

    def _create_cron_detector(self, org, project, name, owner_user=None, owner_team=None):
        """Helper to create a cron detector with data source and monitor."""
        detector = self.create_detector(
            project=project,
            name=f"detector-{name}",
            type="monitor_check_in_failure",
        )

        monitor = self.create_monitor(
            organization=org,
            project=project,
            name=name,
        )
        if owner_user:
            monitor.owner_user_id = owner_user.id
            monitor.owner_team_id = None
        elif owner_team:
            monitor.owner_team_id = owner_team.id
            monitor.owner_user_id = None
        else:
            monitor.owner_user_id = None
            monitor.owner_team_id = None
        monitor.save()

        data_source = DataSource.objects.create(
            organization_id=org.id,
            type="cron_monitor",
            source_id=str(monitor.id),
        )

        DataSourceDetector.objects.create(
            data_source=data_source,
            detector=detector,
        )

        return detector, monitor

    def setup_initial_state(self) -> None:
        self.org = self.create_organization(name="test-org")
        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)
        self.user1 = self.create_user(email="user1@example.com")
        self.user2 = self.create_user(email="user2@example.com")
        self.team1 = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org)
        self.compatible_rule1, self.compatible_workflow1 = self._create_issue_rule_with_workflow(
            project=self.project1,
            condition_data=[
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            ],
        )

        # Another compatible workflow (duplicate conditions for dedup test)
        self.compatible_rule2, self.compatible_workflow2 = self._create_issue_rule_with_workflow(
            project=self.project1,
            condition_data=[
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            ],
        )

        # Compatible workflow with different conditions
        self.compatible_rule3, self.compatible_workflow3 = self._create_issue_rule_with_workflow(
            project=self.project1,
            condition_data=[
                {"id": "sentry.rules.conditions.every_event.EveryEventCondition"},
            ],
        )

        # Incompatible workflow with disallowed conditions
        self.incompatible_rule1, self.incompatible_workflow1 = (
            self._create_issue_rule_with_workflow(
                project=self.project1,
                condition_data=[
                    {
                        "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                        "interval": "1m",
                        "value": 10,
                    },
                    {
                        "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                        "key": "level",
                        "match": "eq",
                        "value": "error",
                    },
                ],
            )
        )

        # Compatible workflow in project2
        self.project2_rule1, self.project2_workflow1 = self._create_issue_rule_with_workflow(
            project=self.project2,
            condition_data=[
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            ],
        )

        # Unassigned workflow in project2 for detector3 (no owner)
        self.project2_unassigned_rule, self.project2_unassigned_workflow = (
            self._create_issue_rule_with_workflow(
                project=self.project2,
                condition_data=[
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                    {
                        "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
                        "targetType": "Unassigned",
                    },
                ],
            )
        )

        # Compatible workflow with same conditions as workflow1/2 but different actions (should NOT dedupe)
        self.compatible_rule4, self.compatible_workflow4 = self._create_issue_rule_with_workflow(
            project=self.project1,
            condition_data=[
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            ],
            action_data=[
                {
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": 67890,  # Different target
                    "targetType": "Member",  # Different type
                }
            ],
        )

        # Mixed compatible/incompatible conditions (should be incompatible overall)
        self.mixed_rule1, self.mixed_workflow1 = self._create_issue_rule_with_workflow(
            project=self.project1,
            condition_data=[
                {
                    "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
                },  # Compatible
                {
                    "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",  # Incompatible
                    "interval": "1m",
                    "value": 5,
                },
            ],
        )

        # Compatible workflow with same conditions but different frequency (should NOT dedupe)
        self.compatible_rule5, self.compatible_workflow5 = self._create_issue_rule_with_workflow(
            project=self.project1,
            condition_data=[
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            ],
            frequency=60,
        )

        # Test other allowed conditions
        self.compatible_rule6, self.compatible_workflow6 = self._create_issue_rule_with_workflow(
            project=self.project1,
            condition_data=[
                {"id": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"},
                {
                    "id": "sentry.rules.filters.age_comparison.AgeComparisonFilter",
                    "comparison_type": "older",
                    "value": 30,
                    "time": "minute",
                },
            ],
        )

        # Project3 with no cron detectors but has issue workflows
        self.project3 = self.create_project(organization=self.org)
        self.project3_rule1, self.project3_workflow1 = self._create_issue_rule_with_workflow(
            project=self.project3,
            condition_data=[
                {"id": "sentry.rules.conditions.every_event.EveryEventCondition"},
            ],
        )

        # Workflows with assigned_to conditions
        self.assigned_team1_rule, self.assigned_team1_workflow = (
            self._create_issue_rule_with_workflow(
                project=self.project1,
                condition_data=[
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                    {
                        "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
                        "targetType": "Team",
                        "targetIdentifier": self.team1.id,
                    },
                ],
            )
        )

        self.assigned_team2_rule, self.assigned_team2_workflow = (
            self._create_issue_rule_with_workflow(
                project=self.project1,
                condition_data=[
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                    {
                        "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
                        "targetType": "Team",
                        "targetIdentifier": self.team2.id,
                    },
                ],
            )
        )

        self.assigned_user1_rule, self.assigned_user1_workflow = (
            self._create_issue_rule_with_workflow(
                project=self.project1,
                condition_data=[
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                    {
                        "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
                        "targetType": "Member",
                        "targetIdentifier": self.user1.id,
                    },
                ],
            )
        )

        self.assigned_unassigned_rule, self.assigned_unassigned_workflow = (
            self._create_issue_rule_with_workflow(
                project=self.project1,
                condition_data=[
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                    {
                        "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
                        "targetType": "Unassigned",
                    },
                ],
            )
        )

        # Workflows with issue_category conditions
        self.issue_category_cron_rule, self.issue_category_cron_workflow = (
            self._create_issue_rule_with_workflow(
                project=self.project1,
                condition_data=[
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                    {
                        "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
                        "value": "4",  # GroupCategory.CRON
                    },
                ],
            )
        )

        self.issue_category_error_rule, self.issue_category_error_workflow = (
            self._create_issue_rule_with_workflow(
                project=self.project1,
                condition_data=[
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                    {
                        "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
                        "value": "1",  # GroupCategory.ERROR
                    },
                ],
            )
        )

        self.issue_category_performance_rule, self.issue_category_performance_workflow = (
            self._create_issue_rule_with_workflow(
                project=self.project1,
                condition_data=[
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                    {
                        "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
                        "value": "2",  # GroupCategory.PERFORMANCE
                    },
                ],
            )
        )

        self.cron_detector1, self.monitor1 = self._create_cron_detector(
            self.org, self.project1, "cron1", owner_team=self.team1
        )
        self.cron_detector2, self.monitor2 = self._create_cron_detector(
            self.org, self.project1, "cron2", owner_user=self.user1
        )
        self.cron_detector3, self.monitor3 = self._create_cron_detector(
            self.org, self.project2, "cron3"
        )
        self.cron_detector4, self.monitor4 = self._create_cron_detector(
            self.org, self.project1, "cron4", owner_team=self.team2
        )

    def test_migration(self) -> None:
        # Should be linked to workflows with compatible conditions
        # Including assigned_to:team1 but NOT assigned_to:team2 or assigned_to:user1
        # Including issue_category:CRON but NOT issue_category:ERROR or issue_category:PERFORMANCE
        detector1_workflows = DetectorWorkflow.objects.filter(detector=self.cron_detector1)
        detector1_workflow_ids = set(detector1_workflows.values_list("workflow_id", flat=True))

        assert len(detector1_workflow_ids) == 7, (
            f"detector1 should have 7 workflows, "
            f"got {len(detector1_workflow_ids)}: {detector1_workflow_ids}"
        )

        has_duplicate = (
            self.compatible_workflow1.id in detector1_workflow_ids
            or self.compatible_workflow2.id in detector1_workflow_ids
        )
        assert has_duplicate, (
            f"detector1 should have one of workflow1/workflow2 (deduped), "
            f"got {detector1_workflow_ids}"
        )

        assert self.compatible_workflow3.id in detector1_workflow_ids, (
            f"detector1 should have compatible_workflow3 (different conditions), "
            f"got {detector1_workflow_ids}"
        )

        assert self.compatible_workflow4.id in detector1_workflow_ids, (
            f"detector1 should have compatible_workflow4 (different actions), "
            f"got {detector1_workflow_ids}"
        )

        assert self.compatible_workflow5.id in detector1_workflow_ids, (
            f"detector1 should have compatible_workflow5 (different frequency), "
            f"got {detector1_workflow_ids}"
        )

        assert self.compatible_workflow6.id in detector1_workflow_ids, (
            f"detector1 should have compatible_workflow6 (age_comparison), "
            f"got {detector1_workflow_ids}"
        )

        assert self.incompatible_workflow1.id not in detector1_workflow_ids, (
            f"detector1 should not have incompatible_workflow1, " f"got {detector1_workflow_ids}"
        )

        assert self.assigned_team1_workflow.id in detector1_workflow_ids, (
            f"detector1 (team1 owner) should have assigned_team1_workflow, "
            f"got {detector1_workflow_ids}"
        )
        assert self.assigned_team2_workflow.id not in detector1_workflow_ids, (
            f"detector1 (team1 owner) should not have assigned_team2_workflow, "
            f"got {detector1_workflow_ids}"
        )
        assert self.assigned_user1_workflow.id not in detector1_workflow_ids, (
            f"detector1 (team1 owner) should not have assigned_user1_workflow, "
            f"got {detector1_workflow_ids}"
        )
        assert self.assigned_unassigned_workflow.id not in detector1_workflow_ids, (
            f"detector1 (team1 owner) should not have assigned_unassigned_workflow, "
            f"got {detector1_workflow_ids}"
        )
        assert self.mixed_workflow1.id not in detector1_workflow_ids, (
            f"detector1 should not have mixed_workflow1 (has incompatible conditions), "
            f"got {detector1_workflow_ids}"
        )

        # Test issue_category conditions
        assert self.issue_category_cron_workflow.id in detector1_workflow_ids, (
            f"detector1 should have issue_category_cron_workflow (category=CRON), "
            f"got {detector1_workflow_ids}"
        )
        assert self.issue_category_error_workflow.id not in detector1_workflow_ids, (
            f"detector1 should not have issue_category_error_workflow (category=ERROR), "
            f"got {detector1_workflow_ids}"
        )
        assert self.issue_category_performance_workflow.id not in detector1_workflow_ids, (
            f"detector1 should not have issue_category_performance_workflow (category=PERFORMANCE), "
            f"got {detector1_workflow_ids}"
        )

        detector2_workflows = DetectorWorkflow.objects.filter(detector=self.cron_detector2)
        detector2_workflow_ids = set(detector2_workflows.values_list("workflow_id", flat=True))

        assert self.assigned_user1_workflow.id in detector2_workflow_ids, (
            f"detector2 (user1 owner) should have assigned_user1_workflow, "
            f"got {detector2_workflow_ids}"
        )
        assert self.assigned_team1_workflow.id not in detector2_workflow_ids, (
            f"detector2 (user1 owner) should not have assigned_team1_workflow, "
            f"got {detector2_workflow_ids}"
        )
        assert self.assigned_unassigned_workflow.id not in detector2_workflow_ids, (
            f"detector2 (user1 owner) should not have assigned_unassigned_workflow, "
            f"got {detector2_workflow_ids}"
        )

        # Test issue_category conditions for detector2
        assert self.issue_category_cron_workflow.id in detector2_workflow_ids, (
            f"detector2 should have issue_category_cron_workflow (category=CRON), "
            f"got {detector2_workflow_ids}"
        )
        assert self.issue_category_error_workflow.id not in detector2_workflow_ids, (
            f"detector2 should not have issue_category_error_workflow (category=ERROR), "
            f"got {detector2_workflow_ids}"
        )
        assert self.issue_category_performance_workflow.id not in detector2_workflow_ids, (
            f"detector2 should not have issue_category_performance_workflow (category=PERFORMANCE), "
            f"got {detector2_workflow_ids}"
        )

        detector3_workflows = DetectorWorkflow.objects.filter(detector=self.cron_detector3)
        detector3_workflow_ids = set(detector3_workflows.values_list("workflow_id", flat=True))

        expected_detector3_workflows = {
            self.project2_workflow1.id,
            self.project2_unassigned_workflow.id,
        }
        assert detector3_workflow_ids == expected_detector3_workflows, (
            f"detector3 (no owner) should have project2 workflows including unassigned, "
            f"expected {expected_detector3_workflows}, got {detector3_workflow_ids}"
        )

        assert (
            self.compatible_workflow1.id not in detector3_workflow_ids
        ), "detector3 should not be linked to project1 workflows"
        assert (
            self.compatible_workflow2.id not in detector3_workflow_ids
        ), "detector3 should not be linked to project1 workflows"

        detector4_workflows = DetectorWorkflow.objects.filter(detector=self.cron_detector4)
        detector4_workflow_ids = set(detector4_workflows.values_list("workflow_id", flat=True))

        assert self.assigned_team2_workflow.id in detector4_workflow_ids, (
            f"detector4 (team2 owner) should have assigned_team2_workflow, "
            f"got {detector4_workflow_ids}"
        )
        assert self.assigned_team1_workflow.id not in detector4_workflow_ids, (
            f"detector4 (team2 owner) should not have assigned_team1_workflow, "
            f"got {detector4_workflow_ids}"
        )
        assert self.assigned_unassigned_workflow.id not in detector4_workflow_ids, (
            f"detector4 (team2 owner) should not have assigned_unassigned_workflow, "
            f"got {detector4_workflow_ids}"
        )
