from sentry.models.rule import RuleSource
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import DetectorWorkflow


class DisconnectCronWorkflowsTest(TestMigrations):
    migrate_from = "0081_add_unique_constraint_to_detector_group"
    migrate_to = "0082_disconnect_error_detector_cron_workflows"
    app = "workflow_engine"

    def setup_initial_state(self):
        self.rule = self.create_project_rule()
        self.cron_rule = self.create_project_rule()

        self.regular_workflow = IssueAlertMigrator(self.rule).run()
        self.cron_workflow = IssueAlertMigrator(self.cron_rule).run()
        self.cron_rule.update(source=RuleSource.CRON_MONITOR)

    def test_migration(self):
        assert DetectorWorkflow.objects.filter(workflow=self.regular_workflow).exists()
        assert not DetectorWorkflow.objects.filter(workflow=self.cron_workflow).exists()
