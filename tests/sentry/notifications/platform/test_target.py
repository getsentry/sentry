from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase


class NotificationTargetTest(TestCase):
    def test_initializes(self):
        GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id="test@example.com",
        )


class IntegrationNotificationTargetTest(TestCase):
    def test_initializes(self):
        integration = self.create_integration(
            organization=self.organization, provider="slack", external_id="ext-123"
        )
        IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C01234567890",
            integration_id=integration.id,
            organization_id=self.organization.id,
        )
