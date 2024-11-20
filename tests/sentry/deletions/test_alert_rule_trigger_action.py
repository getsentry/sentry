from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteAlertRuleTriggerActionTest(TestCase, HybridCloudTestMixin):
    def test_simple(self):
        incident = self.create_incident()
        alert_rule_trigger_action = self.create_alert_rule_trigger_action()
        notification_message = NotificationMessage(
            message_identifier="s3iojewd90j23eqw",
            incident=incident,
            trigger_action=alert_rule_trigger_action,
        )
        notification_message.save()

        self.ScheduledDeletion.schedule(instance=alert_rule_trigger_action, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRuleTriggerAction.objects.filter(id=alert_rule_trigger_action.id).exists()
        assert not NotificationMessage.objects.filter(id=notification_message.id).exists()
