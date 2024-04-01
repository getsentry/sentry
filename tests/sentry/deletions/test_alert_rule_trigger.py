from sentry.incidents.models.alert_rule import AlertRule, AlertRuleTrigger, AlertRuleTriggerAction
from sentry.tasks.deletion.scheduled import run_scheduled_deletions
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteAlertRuleTriggerTest(TestCase, HybridCloudTestMixin):
    def test_simple(self):
        alert_rule = self.create_alert_rule()
        alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        alert_rule_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=alert_rule_trigger
        )

        self.ScheduledDeletion.schedule(instance=alert_rule_trigger, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert AlertRule.objects.filter(id=alert_rule.id).exists()
        assert not AlertRuleTrigger.objects.filter(id=alert_rule_trigger.id).exists()
        assert not AlertRuleTriggerAction.objects.filter(id=alert_rule_trigger_action.id).exists()
