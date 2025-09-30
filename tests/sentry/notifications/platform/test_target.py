from sentry.integrations.slack.integration import SlackIntegration
from sentry.notifications.platform.target import (
    IntegrationNotificationTarget,
    PreparedIntegrationNotificationTarget,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase


class NotificationTargetTest(TestCase):

    def test_prepare_targets(self) -> None:
        integration = self.create_integration(
            organization=self.organization, provider="slack", external_id="ext-123"
        )

        integration_target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C01234567890",
            integration_id=integration.id,
            organization_id=self.organization.id,
        )

        prepared_integration_target = PreparedIntegrationNotificationTarget[SlackIntegration](
            target=integration_target,
            installation_cls=SlackIntegration,
        )

        assert prepared_integration_target.integration is not None
        assert prepared_integration_target.organization_integration is not None
        assert prepared_integration_target.integration.id == integration.id
        assert (
            prepared_integration_target.organization_integration.organization_id
            == self.organization.id
        )
