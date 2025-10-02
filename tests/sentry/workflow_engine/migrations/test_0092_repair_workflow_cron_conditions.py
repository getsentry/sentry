from sentry.models.rule import Rule, RuleSource
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import DataCondition, WorkflowDataConditionGroup


class RepairWorkflowCronConditionsTest(TestMigrations):
    migrate_from = "0091_fix_email_notification_names"
    migrate_to = "0092_repair_workflow_cron_conditions"
    app = "workflow_engine"

    def _create_cron_rule_with_workflow(
        self,
        project,
        monitor_slug,
        frequency=5,
        source=RuleSource.CRON_MONITOR,
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
        Rule.objects.filter(id=rule.id).update(source=source)
        return rule, workflow

    def setup_initial_state(self) -> None:
        # Create organization and project
        self.org = self.create_organization(name="test-org")
        self.project = self.create_project(organization=self.org)

        # Workflows with the condition
        self.cron_rule1, self.cron_workflow1 = self._create_cron_rule_with_workflow(
            project=self.project,
            monitor_slug="monitor-1",
            frequency=5,
            source=RuleSource.CRON_MONITOR,
        )
        self.cron_rule2, self.cron_workflow2 = self._create_cron_rule_with_workflow(
            project=self.project,
            monitor_slug="monitor-2",
            frequency=5,
            source=RuleSource.ISSUE,
        )

        # Workflows without the condition
        self.rule = self.create_project_rule(project=self.project)
        self.workflow = IssueAlertMigrator(self.rule).run()

        self.rule2 = self.create_project_rule(project=self.project)
        self.workflow2 = IssueAlertMigrator(self.rule2).run()
        Rule.objects.filter(id=self.rule2.id).update(source=RuleSource.CRON_MONITOR)

        # Simulate the removal of the monitor.slug condition (0088)
        DataCondition.objects.filter(type="tagged_event").delete()

    def test_migration(self) -> None:
        # Only cron_workflow2 has a repaired condition
        assert DataCondition.objects.filter(type="tagged_event").count() == 1
        assert (
            WorkflowDataConditionGroup.objects.get(workflow_id=self.cron_workflow2.id)
            .condition_group.conditions.all()
            .count()
            == 1
        )
        assert WorkflowDataConditionGroup.objects.get(
            workflow_id=self.cron_workflow2.id
        ).condition_group.conditions.all()[0].comparison == {
            "key": "monitor.slug",
            "match": "eq",
            "value": "monitor-2",
        }
