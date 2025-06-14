from typing import cast

import pytest

from sentry.notifications.platform.target import (
    IntegrationNotificationTarget,
    NotificationTarget,
    NotificationTargetError,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase


class NotificationTargetTest(TestCase):
    def test_validates_when_initialized(self):
        with pytest.raises(
            NotificationTargetError, match="Could not find registration for 'pigeon'"
        ):
            NotificationTarget(
                provider_key=cast(NotificationProviderKey, "pigeon"),
                resource_type=NotificationTargetResourceType.DIRECT_MESSAGE,
                resource_id="tweety",
            )

        # Initializes with a valid target
        NotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id="test@example.com",
        )


class IntegrationNotificationTargetTest(TestCase):
    def test_validates_when_initialized(self):
        with pytest.raises(
            NotificationTargetError, match="Could not find integration installation"
        ):
            IntegrationNotificationTarget(
                provider_key=NotificationProviderKey.SLACK,
                resource_type=NotificationTargetResourceType.CHANNEL,
                resource_id="C01234567890",
                integration_id=self.integration.id,
                organization_id=-1,
            )

        with pytest.raises(
            NotificationTargetError,
            match="Retrieved 'github' integration did not match target provider of 'slack'",
        ):
            IntegrationNotificationTarget(
                provider_key=NotificationProviderKey.SLACK,
                resource_type=NotificationTargetResourceType.CHANNEL,
                resource_id="C01234567890",
                # self.integration defaults to a GitHub integration
                integration_id=self.integration.id,
                organization_id=self.organization.id,
            )

        # Initializes with a valid target
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
