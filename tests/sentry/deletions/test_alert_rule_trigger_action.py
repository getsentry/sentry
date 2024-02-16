from sentry.constants import ObjectStatus
from sentry.models.notificationmessage import NotificationMessage
from sentry.tasks.deletion.scheduled import run_scheduled_deletions
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DeleteAlertRuleTriggerActionTest(TestCase, HybridCloudTestMixin):
    def test_simple(self):
        incident = self.create_incident()
        action = self.create_alert_rule_trigger_action()
        notification_message = NotificationMessage(
            message_identifier="s3iojewd90j23eqw",
            incident=incident,
            trigger_action=action,
        )
        notification_message.save()

        self.ScheduledDeletion.schedule(instance=action, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not NotificationMessage.objects.filter(
            id=notification_message.id, status=ObjectStatus.PENDING_DELETION
        ).exists()
