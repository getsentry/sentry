from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
    prepare_targets,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTarget,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase


class NotificationTargetTest(TestCase):

    def test_prepare_targets(self):
        integration = self.create_integration(
            organization=self.organization, provider="slack", external_id="ext-123"
        )

        generic_target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id="test@example.com",
        )
        integration_target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C01234567890",
            integration_id=integration.id,
            organization_id=self.organization.id,
        )

        targets: list[NotificationTarget] = [generic_target, integration_target]

        for target in targets:
            assert not target.is_prepared

        prepare_targets(targets)

        for target in targets:
            assert target.is_prepared
