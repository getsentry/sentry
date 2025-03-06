from uuid import uuid4

from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.fake_log_integration.notification_class import LoggingNotification
from sentry.notifications.models import (
    ActionService,
    ActionTarget,
    ActionTrigger,
    NotificationAction,
)
from sentry.testutils.cases import TestCase
from sentry.types.actor import Actor


class TestMetricNotification(TestCase):
    def setUp(self):
        self.new_integration = self.create_integration(
            self.organization, "woof", metadata={}, name="TestLogger", provider="fake-log"
        )
        self.alert_rule = self.create_alert_rule(
            organization=self.organization, projects=[self.project]
        )
        self.alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=self.alert_rule)
        self.alert_rule_trigger_action = self.create_alert_rule_trigger_action(
            type=AlertRuleTriggerAction.Type.FAKE_LOG, target_type=ActionTarget.SPECIFIC
        )
        self.incident = self.create_incident(
            organization=self.organization, projects=[self.project]
        )

    def test_fake_log_trigger(self):
        self.alert_rule_trigger_action.fire(
            self.alert_rule_trigger_action,
            self.incident,
            project=self.project,
            metric_value=100,
            new_status=IncidentStatus.OPEN,
            notification_uuid=uuid4().hex,
        )


class TestNotificationClass(TestCase):
    def setUp(self):
        super().setUp()
        self.new_integration = self.create_integration(
            self.organization, "woof", metadata={}, name="TestLogger", provider="fake-log"
        )

    def create_notification_and_recipient(self):
        recipient = Actor.from_orm_user(self.user)
        notification = LoggingNotification(self.organization, recipient, "test-identifier")
        return notification, recipient

    def test_send_notification(self):
        """Test that notifications are sent correctly through the fake log integration"""
        # Setup mocks
        # Call the notification function
        notification, recipient = self.create_notification_and_recipient()

        notification.send()


class TestSpikeProtectionNotification(TestCase):
    def setUp(self):
        super().setUp()
        self.new_integration = self.create_integration(
            self.organization, "woof", metadata={}, name="TestLogger", provider="fake-log"
        )

    def test_send_spike_protection_notification(self):
        # Typical pattern here is: Creating a new NotificationAction model instance
        # Retrieving the model instance, and invoking Fire with arbitrary params
        notification_action = NotificationAction.objects.create(
            organization_id=self.organization.id,
            trigger_type=ActionTrigger.FAKE_LOGGER_EXAMPLE.value,
            type=ActionService.FAKE_LOG.value,
            target_type=ActionTarget.SPECIFIC.value,
            target_identifier="default",
            target_display="default",
        )

        notification_action.fire(
            {
                "message": "Test",
            }
        )
