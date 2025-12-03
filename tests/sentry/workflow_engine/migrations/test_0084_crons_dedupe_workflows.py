import pytest

from sentry.models.rule import Rule, RuleSource
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import (
    AlertRuleWorkflow,
    DataSource,
    DataSourceDetector,
    DetectorWorkflow,
    Workflow,
)


@pytest.mark.skip(reason="Already run, fails when defaulting dual write in workflow engine")
class DedupeCronWorkflowsTest(TestMigrations):
    migrate_from = "0083_add_status_to_action"
    migrate_to = "0084_crons_dedupe_workflows"
    app = "workflow_engine"

    def _create_cron_rule_with_workflow(
        self,
        project,
        monitor_slug,
        frequency=5,
        environment=None,
        owner_user=None,
        owner_team=None,
        action_data=None,
        condition_data=None,
    ):
        """Helper to create a cron rule with its workflow and return both"""
        if action_data is None:
            action_data = [
                {
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": 12345,
                    "targetType": "Team",
                    "uuid": "will-be-removed",
                }
            ]
        if condition_data is None:
            condition_data = [
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            ]

        rule = self.create_project_rule(
            project=project,
            action_data=action_data,
            condition_data=condition_data
            + [
                {
                    "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                    "key": "monitor.slug",
                    "match": "eq",
                    "value": monitor_slug,
                }
            ],
            filter_match="all",
            action_match="any",
            frequency=frequency,
            environment_id=environment.id if environment else None,
            owner_user_id=owner_user.id if owner_user else None,
            owner_team_id=owner_team.id if owner_team else None,
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
        # Create two organizations to test cross-org isolation
        self.org1 = self.create_organization(name="org1")
        self.org2 = self.create_organization(name="org2")

        self.project1 = self.create_project(organization=self.org1)
        self.project2 = self.create_project(organization=self.org2)

        # Create environments and users/teams for testing different deduplication scenarios
        self.env1 = self.create_environment(project=self.project1, name="production")
        self.env2 = self.create_environment(project=self.project1, name="staging")
        self.user1 = self.create_user()
        self.user2 = self.create_user()
        self.user3 = self.create_user()  # For same_user_duplicates test case to avoid overlap
        self.team1 = self.create_team(organization=self.org1)
        self.team2 = self.create_team(organization=self.org1)

        # === Test Case 1: Basic duplicates (same everything) - should deduplicate ===
        self.org1_cron_rule1, self.org1_workflow1 = self._create_cron_rule_with_workflow(
            project=self.project1, monitor_slug="monitor-1", frequency=5
        )
        self.org1_cron_rule2, self.org1_workflow2 = self._create_cron_rule_with_workflow(
            project=self.project1, monitor_slug="monitor-2", frequency=5
        )

        # === Test Case 2: Different frequency - should NOT deduplicate ===
        self.org1_cron_rule_diff_freq, self.org1_workflow_diff_freq = (
            self._create_cron_rule_with_workflow(
                project=self.project1, monitor_slug="monitor-diff-freq", frequency=1440
            )
        )

        # === Test Case 3: Different owner_user - should NOT deduplicate ===
        self.org1_cron_rule_user1, self.org1_workflow_user1 = self._create_cron_rule_with_workflow(
            project=self.project1, monitor_slug="monitor-user1", frequency=5, owner_user=self.user1
        )
        self.org1_cron_rule_user2, self.org1_workflow_user2 = self._create_cron_rule_with_workflow(
            project=self.project1, monitor_slug="monitor-user2", frequency=5, owner_user=self.user2
        )

        # === Test Case 4: Different owner_team - should NOT deduplicate ===
        self.org1_cron_rule_team1, self.org1_workflow_team1 = self._create_cron_rule_with_workflow(
            project=self.project1, monitor_slug="monitor-team1", frequency=5, owner_team=self.team1
        )
        self.org1_cron_rule_team2, self.org1_workflow_team2 = self._create_cron_rule_with_workflow(
            project=self.project1, monitor_slug="monitor-team2", frequency=5, owner_team=self.team2
        )

        # === Test Case 5: Different environment - should NOT deduplicate ===
        self.org1_cron_rule_env1, self.org1_workflow_env1 = self._create_cron_rule_with_workflow(
            project=self.project1, monitor_slug="monitor-env1", frequency=5, environment=self.env1
        )
        self.org1_cron_rule_env2, self.org1_workflow_env2 = self._create_cron_rule_with_workflow(
            project=self.project1, monitor_slug="monitor-env2", frequency=5, environment=self.env2
        )

        # === Test Case 6: Same user owner - should deduplicate ===
        self.org1_cron_rule_same_user1, self.org1_workflow_same_user1 = (
            self._create_cron_rule_with_workflow(
                project=self.project1,
                monitor_slug="monitor-same-user1",
                frequency=5,
                owner_user=self.user3,  # Using user3 to avoid overlap with user1 test case
            )
        )
        self.org1_cron_rule_same_user2, self.org1_workflow_same_user2 = (
            self._create_cron_rule_with_workflow(
                project=self.project1,
                monitor_slug="monitor-same-user2",
                frequency=5,
                owner_user=self.user3,  # Same user as above (user3)
            )
        )

        # === Test Case 7: Cross-org isolation - should NOT deduplicate ===
        self.org2_cron_rule1, self.org2_workflow1 = self._create_cron_rule_with_workflow(
            project=self.project2, monitor_slug="org2-monitor-1", frequency=5
        )

        # Create a regular non-cron rule (should be unaffected)
        self.regular_rule = self.create_project_rule(
            project=self.project1,
            action_data=[
                {
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": 12345,
                    "targetType": "Team",
                }
            ],
            condition_data=[
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            ],
            frequency=5,
        )
        self.regular_workflow = IssueAlertMigrator(self.regular_rule).run()

        # Create monitors and detectors for all cron rules
        self.monitor1, self.detector1 = self._create_monitor_with_detector(
            self.org1, self.project1, self.org1_cron_rule1, "monitor-1"
        )
        self.monitor2, self.detector2 = self._create_monitor_with_detector(
            self.org1, self.project1, self.org1_cron_rule2, "monitor-2"
        )

        self.monitor_diff_freq, self.detector_diff_freq = self._create_monitor_with_detector(
            self.org1, self.project1, self.org1_cron_rule_diff_freq, "monitor-diff-freq"
        )

        self.monitor_user1, self.detector_user1 = self._create_monitor_with_detector(
            self.org1, self.project1, self.org1_cron_rule_user1, "monitor-user1"
        )
        self.monitor_user2, self.detector_user2 = self._create_monitor_with_detector(
            self.org1, self.project1, self.org1_cron_rule_user2, "monitor-user2"
        )

        self.monitor_team1, self.detector_team1 = self._create_monitor_with_detector(
            self.org1, self.project1, self.org1_cron_rule_team1, "monitor-team1"
        )
        self.monitor_team2, self.detector_team2 = self._create_monitor_with_detector(
            self.org1, self.project1, self.org1_cron_rule_team2, "monitor-team2"
        )

        self.monitor_env1, self.detector_env1 = self._create_monitor_with_detector(
            self.org1, self.project1, self.org1_cron_rule_env1, "monitor-env1"
        )
        self.monitor_env2, self.detector_env2 = self._create_monitor_with_detector(
            self.org1, self.project1, self.org1_cron_rule_env2, "monitor-env2"
        )

        self.monitor_same_user1, self.detector_same_user1 = self._create_monitor_with_detector(
            self.org1, self.project1, self.org1_cron_rule_same_user1, "monitor-same-user1"
        )
        self.monitor_same_user2, self.detector_same_user2 = self._create_monitor_with_detector(
            self.org1, self.project1, self.org1_cron_rule_same_user2, "monitor-same-user2"
        )

        self.org2_monitor1, self.org2_detector1 = self._create_monitor_with_detector(
            self.org2, self.project2, self.org2_cron_rule1, "org2-monitor-1"
        )

        # Store initial workflow IDs for verification
        self.workflow_groups = {
            # Should deduplicate (same config)
            "basic_duplicates": [self.org1_workflow1.id, self.org1_workflow2.id],
            # Should deduplicate (same user owner)
            "same_user_duplicates": [
                self.org1_workflow_same_user1.id,
                self.org1_workflow_same_user2.id,
            ],
            # Should NOT deduplicate (different frequency)
            "diff_freq": [self.org1_workflow_diff_freq.id],
            # Should NOT deduplicate (different users)
            "diff_users": [self.org1_workflow_user1.id, self.org1_workflow_user2.id],
            # Should NOT deduplicate (different teams)
            "diff_teams": [self.org1_workflow_team1.id, self.org1_workflow_team2.id],
            # Should NOT deduplicate (different environments)
            "diff_envs": [self.org1_workflow_env1.id, self.org1_workflow_env2.id],
            # Cross-org (should NOT deduplicate)
            "org2": [self.org2_workflow1.id],
            # Regular non-cron (should be unaffected)
            "regular": [self.regular_workflow.id],
        }

    def _verify_workflow_deduplication(self, workflow_ids, should_deduplicate, group_name):
        """Helper to verify if workflows were properly deduplicated or preserved"""
        existing_workflows = [
            wf_id for wf_id in workflow_ids if Workflow.objects.filter(id=wf_id).exists()
        ]

        if should_deduplicate:
            assert len(existing_workflows) == 1, (
                f"{group_name}: Should have exactly 1 workflow after deduplication, "
                f"but found {len(existing_workflows)}"
            )
        else:
            assert len(existing_workflows) == len(workflow_ids), (
                f"{group_name}: All {len(workflow_ids)} workflows should be preserved, "
                f"but only found {len(existing_workflows)}"
            )
        return existing_workflows

    def test_migration(self) -> None:
        # Test Case 1: Basic duplicates should be deduplicated
        basic_duplicates = self._verify_workflow_deduplication(
            self.workflow_groups["basic_duplicates"],
            should_deduplicate=True,
            group_name="Basic duplicates",
        )
        # Verify both detectors point to the same workflow
        detector1_wf = DetectorWorkflow.objects.get(detector=self.detector1)
        detector2_wf = DetectorWorkflow.objects.get(detector=self.detector2)
        assert (
            detector1_wf.workflow_id == detector2_wf.workflow_id
        ), "Detectors from deduplicated rules should point to same workflow"
        assert (
            detector1_wf.workflow_id == basic_duplicates[0]
        ), "Detectors should point to the surviving workflow"

        # Test Case 2: Same user owner duplicates should be deduplicated
        self._verify_workflow_deduplication(
            self.workflow_groups["same_user_duplicates"],
            should_deduplicate=True,
            group_name="Same user duplicates",
        )
        detector_same_user1_wf = DetectorWorkflow.objects.get(detector=self.detector_same_user1)
        detector_same_user2_wf = DetectorWorkflow.objects.get(detector=self.detector_same_user2)
        assert (
            detector_same_user1_wf.workflow_id == detector_same_user2_wf.workflow_id
        ), "Detectors from rules with same user owner should point to same workflow"

        # Test Case 3: Different frequency should NOT deduplicate
        self._verify_workflow_deduplication(
            self.workflow_groups["diff_freq"],
            should_deduplicate=False,
            group_name="Different frequency",
        )

        # Test Case 4: Different users should NOT deduplicate
        self._verify_workflow_deduplication(
            self.workflow_groups["diff_users"],
            should_deduplicate=False,
            group_name="Different users",
        )
        detector_user1_wf = DetectorWorkflow.objects.get(detector=self.detector_user1)
        detector_user2_wf = DetectorWorkflow.objects.get(detector=self.detector_user2)
        assert (
            detector_user1_wf.workflow_id != detector_user2_wf.workflow_id
        ), "Detectors from rules with different users should have different workflows"

        # Test Case 5: Different teams should NOT deduplicate
        self._verify_workflow_deduplication(
            self.workflow_groups["diff_teams"],
            should_deduplicate=False,
            group_name="Different teams",
        )
        detector_team1_wf = DetectorWorkflow.objects.get(detector=self.detector_team1)
        detector_team2_wf = DetectorWorkflow.objects.get(detector=self.detector_team2)
        assert (
            detector_team1_wf.workflow_id != detector_team2_wf.workflow_id
        ), "Detectors from rules with different teams should have different workflows"

        # Test Case 6: Different environments should NOT deduplicate
        self._verify_workflow_deduplication(
            self.workflow_groups["diff_envs"],
            should_deduplicate=False,
            group_name="Different environments",
        )
        detector_env1_wf = DetectorWorkflow.objects.get(detector=self.detector_env1)
        detector_env2_wf = DetectorWorkflow.objects.get(detector=self.detector_env2)
        assert (
            detector_env1_wf.workflow_id != detector_env2_wf.workflow_id
        ), "Detectors from rules with different environments should have different workflows"

        # Test Case 7: Cross-org isolation
        self._verify_workflow_deduplication(
            self.workflow_groups["org2"], should_deduplicate=False, group_name="Cross-org"
        )

        # Test Case 8: Regular non-cron workflow should be unaffected
        self._verify_workflow_deduplication(
            self.workflow_groups["regular"], should_deduplicate=False, group_name="Regular non-cron"
        )

        # Verify AlertRuleWorkflow links are maintained
        # The basic duplicates should still have AlertRuleWorkflow pointing to first rule
        alert_rule_workflows = AlertRuleWorkflow.objects.filter(workflow_id=basic_duplicates[0])
        assert (
            alert_rule_workflows.exists()
        ), "AlertRuleWorkflow should exist for surviving workflow"
        first_workflow = alert_rule_workflows.first()
        assert first_workflow
        assert (
            first_workflow.rule_id == self.org1_cron_rule1.id
        ), "AlertRuleWorkflow should point to first rule in deduplication group"
