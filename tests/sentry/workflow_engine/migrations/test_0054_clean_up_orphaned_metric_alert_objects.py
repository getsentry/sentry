from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.migration_helpers.alert_rule import dual_write_alert_rule
from sentry.workflow_engine.models import (
    Action,
    ActionAlertRuleTriggerAction,
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
)


class TestCleanUpOrphanedMetricAlertObjects(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0053_add_legacy_rule_indices"
    migrate_to = "0054_clean_up_orphaned_metric_alert_objects"

    def setup_before_migration(self, apps):
        self.alert_rule = self.create_alert_rule(name="hojicha")
        self.trigger = self.create_alert_rule_trigger(alert_rule=self.alert_rule)
        self.action = self.create_alert_rule_trigger_action(alert_rule_trigger=self.trigger)

        dual_write_alert_rule(self.alert_rule)

        detector = AlertRuleDetector.objects.get(alert_rule_id=self.alert_rule.id).detector
        workflow = AlertRuleWorkflow.objects.get(alert_rule_id=self.alert_rule.id).workflow

        detector.delete()
        workflow.delete()

        assert (
            ActionAlertRuleTriggerAction.objects.filter(
                alert_rule_trigger_action_id=self.action.id
            ).count()
            == 1
        )
        assert Action.objects.count() == 1
        assert DataConditionGroupAction.objects.count() == 1
        # For each dual write attempt: one condition group on the detector, one action filter connected to the workflow
        assert DataConditionGroup.objects.count() == 2
        assert DataCondition.objects.count() == 3  # 2 detector triggers and one action filter DC

    def test(self):
        assert DataConditionGroup.objects.count() == 0
        assert DataCondition.objects.count() == 0
        assert (
            ActionAlertRuleTriggerAction.objects.filter(
                alert_rule_trigger_action_id=self.action.id
            ).count()
            == 0
        )
        assert Action.objects.count() == 0
        assert DataConditionGroupAction.objects.count() == 0
