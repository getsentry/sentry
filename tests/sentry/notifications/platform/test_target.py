from typing import int
from unittest.mock import MagicMock, patch

import pytest

from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.slack.integration import SlackIntegration
from sentry.notifications.platform.target import (
    IntegrationNotificationTarget,
    NotificationTargetError,
    PreparedIntegrationNotificationTarget,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


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


class PreparedIntegrationNotificationTargetTest(TestCase):

    def test_prepare_targets_invalid_integration(self) -> None:
        self.create_integration(
            organization=self.organization, provider="slack", external_id="ext-123"
        )
        integration_target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C01234567890",
            integration_id=99999,
            organization_id=self.organization.id,
        )
        with pytest.raises(NotificationTargetError, match="Integration 99999 not found"):
            PreparedIntegrationNotificationTarget[SlackIntegration](
                target=integration_target,
                installation_cls=SlackIntegration,
            ).integration

    def test_prepare_targets_invalid_organization_integration(self) -> None:
        self.create_integration(
            organization=self.organization, provider="slack", external_id="ext-123"
        )
        integration_target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C01234567890",
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            organization_integration = OrganizationIntegration.objects.get(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
            )
            organization_integration.delete()

        with pytest.raises(
            NotificationTargetError,
            match=f"Organization integration for integration {self.integration.id} and organization {self.organization.id} not found",
        ):
            PreparedIntegrationNotificationTarget[SlackIntegration](
                target=integration_target,
                installation_cls=SlackIntegration,
            ).organization_integration

    @patch("sentry.integrations.slack.integration.SlackSdkClient.chat_postMessage")
    def test_prepare_targets_valid_installation_cls(self, mock_slack_client: MagicMock) -> None:
        integration_target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C01234567890",
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )
        prepared_integration_target = PreparedIntegrationNotificationTarget[SlackIntegration](
            target=integration_target,
            installation_cls=SlackIntegration,
        )
        assert prepared_integration_target.integration_installation is not None
        prepared_integration_target.integration_installation.send_message(
            channel_id="C01234567890",
            message="Hello, world!",
        )
        mock_slack_client.assert_called_once_with(channel="C01234567890", text="Hello, world!")
