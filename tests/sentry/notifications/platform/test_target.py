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
        NotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id="test@example.com",
        )
        with pytest.raises(
            NotificationTargetError, match="Could not find registration for 'pigeon'"
        ):
            NotificationTarget(
                provider_key=cast(NotificationProviderKey, "pigeon"),
                resource_type=NotificationTargetResourceType.DIRECT_MESSAGE,
                resource_id="tweety",
            )


class IntegrationNotificationTargetTest(TestCase):
    def test_validates_when_initialized(self):
        IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C01234567890",
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )
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
