from unittest.mock import Mock

from sentry.integrations.fake_log_integration.notification_class import LoggingNotification
from sentry.integrations.models.integration import Integration
from sentry.notifications.models import (
    ActionService,
    ActionTarget,
    ActionTrigger,
    NotificationAction,
)
from sentry.testutils.cases import TestCase
from sentry.types.actor import Actor


class TestLoggingNotification(TestCase):
    def setUp(self):
        super().setUp()
        self.integration = Mock(spec=Integration)
        self.target_identifier = "test-identifier"
        self.notification = LoggingNotification(self.integration, self.target_identifier)

    def test_initialization(self):
        """Test that the notification is initialized with correct attributes"""
        assert self.notification.integration == self.integration
        assert self.notification.target_identifier == self.target_identifier


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
