from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import AlertRuleWorkflow, Workflow


# @pytest.mark.skip("Timeout failures—skipping these tests, which pass, to unblock migration.")
class MigrateErroredMetricAlertTest(TestMigrations):
    migrate_from = "0051_migrate_remaining_issue_alerts"
    migrate_to = "0052_migrate_errored_metric_alerts"
    app = "workflow_engine"

    def setUp(self):
        return super().setUp()

    def setup_initial_state(self):
        user = self.create_user()
        self.rule_missing_org_member = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(alert_rule=self.rule_missing_org_member)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, target_identifier=str(user.id)
        )

        team = self.create_team(organization=self.organization)
        self.rule_missing_team = self.create_alert_rule(organization=self.organization)
        trigger = self.create_alert_rule_trigger(alert_rule=self.rule_missing_team)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger,
            target_identifier=str(team.id),
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
        )
        team.delete()

        migrated = self.create_alert_rule(organization=self.organization)
        trigger = self.create_alert_rule_trigger(alert_rule=migrated)
        self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)

    def test_missing_org_member(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(
            alert_rule_id=self.rule_missing_org_member.id
        )
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)

        assert workflow.name == "Email [removed]"

    def test_missing_team(self):
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=self.rule_missing_team.id)
        workflow = Workflow.objects.get(id=alert_rule_workflow.workflow.id)

        assert workflow.name == "Email [removed]"
