from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleTrigger, AlertRuleTriggerAction
from sentry.incidents.models.incident import IncidentTrigger, TriggerStatus
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.workflow_engine.models import DataConditionAlertRuleTrigger
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DeleteAlertRuleTriggerTest(BaseWorkflowTest, HybridCloudTestMixin):
    def test_simple(self) -> None:
        alert_rule = self.create_alert_rule()
        alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        alert_rule_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=alert_rule_trigger
        )
        data_condition = self.create_data_condition()
        DataConditionAlertRuleTrigger.objects.create(
            data_condition=data_condition, alert_rule_trigger_id=alert_rule_trigger.id
        )
        incident = self.create_incident(alert_rule=alert_rule)
        incident_trigger = self.create_incident_trigger(
            incident=incident,
            alert_rule_trigger=alert_rule_trigger,
            status=TriggerStatus.ACTIVE.value,
        )

        self.ScheduledDeletion.schedule(instance=alert_rule_trigger, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert AlertRule.objects.filter(id=alert_rule.id).exists()
        assert not AlertRuleTrigger.objects.filter(id=alert_rule_trigger.id).exists()
        assert not AlertRuleTriggerAction.objects.filter(id=alert_rule_trigger_action.id).exists()
        assert not IncidentTrigger.objects.filter(id=incident_trigger.id).exists()
        assert not DataConditionAlertRuleTrigger.objects.filter(
            alert_rule_trigger_id=alert_rule_trigger.id
        ).exists()
