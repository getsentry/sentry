from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.workflow_engine.models import ActionAlertRuleTriggerAction
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DeleteAlertRuleTriggerActionTest(BaseWorkflowTest, HybridCloudTestMixin):
    def test_simple(self) -> None:
        alert_rule_trigger_action = self.create_alert_rule_trigger_action()
        action = self.create_action()
        ActionAlertRuleTriggerAction.objects.create(
            action=action, alert_rule_trigger_action_id=alert_rule_trigger_action.id
        )

        self.ScheduledDeletion.schedule(instance=alert_rule_trigger_action, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRuleTriggerAction.objects.filter(id=alert_rule_trigger_action.id).exists()
        assert not ActionAlertRuleTriggerAction.objects.filter(
            alert_rule_trigger_action_id=alert_rule_trigger_action.id
        ).exists()
