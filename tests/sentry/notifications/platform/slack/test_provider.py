from typing import Any
from unittest.mock import Mock, patch

import pytest
from django.core.exceptions import ValidationError

from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.platform.provider import NotificationProviderError
from sentry.notifications.platform.slack.provider import SlackNotificationProvider, SlackRenderable
from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification, MockNotificationTemplate


class SlackRendererTest(TestCase):
    def test_default_renderer(self) -> None:
        data = MockNotification(message="test")
        template = MockNotificationTemplate()
        rendered_template = template.render(data)
        renderer = SlackNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        rendererable = renderer.render(data=data, rendered_template=rendered_template)
        rendererable_dict = [block.to_dict() for block in rendererable.get("blocks", [])]

        assert rendererable_dict == [
            {"text": {"text": "Mock Notification", "type": "plain_text"}, "type": "header"},
            {"text": {"text": "test", "type": "mrkdwn"}, "type": "section"},
            {
                "elements": [
                    {
                        "text": {"emoji": True, "text": "Visit Sentry", "type": "plain_text"},
                        "type": "button",
                        "url": "https://www.sentry.io",
                    }
                ],
                "type": "actions",
            },
            {"text": {"text": "This is a mock footer", "type": "mrkdwn"}, "type": "section"},
            {
                "image_url": "https://raw.githubusercontent.com/knobiknows/all-the-bufo/main/all-the-bufo/bufo-pog.png",
                "alt_text": "Bufo Pog",
                "type": "image",
            },
        ]


class SlackNotificationProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.SLACK,
            organization=self.organization,
            user=self.user,
            name="test-slack",
            metadata={"domain_name": "test-workspace.slack.com"},
        )

    def test_basic_fields(self) -> None:
        provider = SlackNotificationProvider()
        assert provider.key == NotificationProviderKey.SLACK
        assert provider.target_class == IntegrationNotificationTarget
        assert provider.target_resource_types == [
            NotificationTargetResourceType.CHANNEL,
            NotificationTargetResourceType.DIRECT_MESSAGE,
        ]

    def test_is_available(self) -> None:
        assert SlackNotificationProvider.is_available() is False
        assert SlackNotificationProvider.is_available(organization=self.organization) is False


class SlackNotificationProviderValidateTargetTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.SLACK,
            organization=self.organization,
            user=self.user,
            name="test-slack",
            metadata={"domain_name": "test-workspace.slack.com"},
        )

    def _create_target(
        self,
        resource_id: str = "C1234567890",
        resource_type: NotificationTargetResourceType = NotificationTargetResourceType.CHANNEL,
        integration: Any = None,
    ) -> IntegrationNotificationTarget:
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_id=resource_id,
            resource_type=resource_type,
            integration_id=integration.id if integration else self.integration.id,
            organization_id=self.organization.id,
        )

        # Manually set the integration fields (prepare_targets is a stub)
        rpc_integration = integration_service.get_integration(integration_id=target.integration_id)
        rpc_org_integration = integration_service.get_organization_integration(
            integration_id=target.integration_id,
            organization_id=target.organization_id,
        )

        object.__setattr__(target, "integration", rpc_integration)
        object.__setattr__(target, "organization_integration", rpc_org_integration)

        return target

    def test_validate_target_invalid_target_class(self) -> None:
        """Test validation fails with wrong target class"""
        from sentry.notifications.platform.target import GenericNotificationTarget

        target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_id="test@example.com",
            resource_type=NotificationTargetResourceType.EMAIL,
        )

        with pytest.raises(NotificationProviderError, match="Target .* is not a valid dataclass"):
            SlackNotificationProvider.validate_target(target=target)

    def test_validate_target_wrong_provider_key(self) -> None:
        """Test validation fails with wrong provider key"""
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,  # Wrong provider
            resource_id="C1234567890",
            resource_type=NotificationTargetResourceType.CHANNEL,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        with pytest.raises(NotificationProviderError, match="Target intended for 'email' provider"):
            SlackNotificationProvider.validate_target(target=target)

    def test_validate_target_unsupported_resource_type(self) -> None:
        """Test validation fails with unsupported resource type"""
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_id="test@example.com",
            resource_type=NotificationTargetResourceType.EMAIL,  # Not supported by Slack
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        with pytest.raises(
            NotificationProviderError, match="Target with resource type 'email' is not supported"
        ):
            SlackNotificationProvider.validate_target(target=target)

    @patch("sentry.notifications.platform.slack.provider.validate_slack_entity_id")
    def test_validate_target_integration_not_found(self, mock_validate_slack: Mock) -> None:
        """Test validation fails when integration doesn't exist"""
        mock_validate_slack.return_value = True
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_id="C1234567890",
            resource_type=NotificationTargetResourceType.CHANNEL,
            integration_id=999,
            organization_id=self.organization.id,
        )
        rpc_org_integration = integration_service.get_organization_integration(
            integration_id=target.integration_id,
            organization_id=target.organization_id,
        )
        object.__setattr__(target, "organization_integration", rpc_org_integration)

        with pytest.raises(
            NotificationProviderError, match="Integration with id '999' was not prepared for target"
        ):
            SlackNotificationProvider.validate_target(target=target)

    @patch("sentry.notifications.platform.slack.provider.validate_slack_entity_id")
    def test_validate_target_org_integration_not_found(self, mock_validate_slack: Mock) -> None:
        mock_validate_slack.return_value = True
        """Test validation fails when organization integration doesn't exist"""
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_id="C1234567890",
            resource_type=NotificationTargetResourceType.CHANNEL,
            integration_id=999,
            organization_id=self.organization.id,
        )
        rpc_integration = integration_service.get_integration(integration_id=target.integration_id)
        object.__setattr__(target, "integration", rpc_integration)

        with pytest.raises(
            NotificationProviderError,
            match=f"Organization integration for integration, '{target.integration_id}' and organization, '{target.organization_id}' was not prepared for target",
        ):
            SlackNotificationProvider.validate_target(target=target)

    @patch("sentry.notifications.platform.slack.provider.validate_integration_for_target")
    @patch("sentry.notifications.platform.slack.provider.validate_slack_entity_id")
    def test_validate_target_slack_channel_validation_error(
        self, mock_validate_slack: Mock, mock_validate_integration: Mock
    ) -> None:
        """Test validation fails when Slack channel validation fails with ValidationError"""
        mock_validate_integration.return_value = None  # Integration validation passes
        mock_validate_slack.side_effect = ValidationError("Invalid channel")

        target = self._create_target(resource_id="invalid-channel")

        with pytest.raises(
            NotificationProviderError,
            match="Slack channel or user with id 'invalid-channel' could not be validated",
        ):
            SlackNotificationProvider.validate_target(target=target)


class SlackNotificationProviderSendTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.SLACK,
            organization=self.organization,
            user=self.user,
            name="test-slack",
            metadata={"domain_name": "test-workspace.slack.com"},
        )

    def _create_target(self, resource_id: str = "C1234567890") -> IntegrationNotificationTarget:
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_id=resource_id,
            resource_type=NotificationTargetResourceType.CHANNEL,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        # Manually set the integration fields (prepare_targets is a stub)
        rpc_integration = integration_service.get_integration(integration_id=target.integration_id)
        rpc_org_integration = integration_service.get_organization_integration(
            integration_id=target.integration_id,
            organization_id=target.organization_id,
        )

        object.__setattr__(target, "integration", rpc_integration)
        object.__setattr__(target, "organization_integration", rpc_org_integration)

        return target

    def _create_renderable(self) -> SlackRenderable:
        """Create a sample SlackRenderable for testing"""
        from slack_sdk.models.blocks import (
            HeaderBlock,
            MarkdownTextObject,
            PlainTextObject,
            SectionBlock,
        )

        return SlackRenderable(
            blocks=[
                HeaderBlock(text=PlainTextObject(text="Test Notification")),
                SectionBlock(text=MarkdownTextObject(text="This is a test message")),
            ]
        )

    @patch("sentry.notifications.platform.slack.provider.SlackSdkClient")
    def test_send_success(self, mock_slack_client: Mock) -> None:
        """Test successful message sending"""
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = {"ok": True, "ts": "1234567890.123456"}

        target = self._create_target()
        renderable = self._create_renderable()

        SlackNotificationProvider.send(target=target, renderable=renderable)

        mock_client_instance.chat_postMessage.assert_called_once_with(
            channel="C1234567890", blocks=renderable["blocks"]
        )

    def test_send_invalid_target_class(self) -> None:
        """Test send fails with invalid target class"""

        target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_id="test@example.com",
            resource_type=NotificationTargetResourceType.EMAIL,
        )
        renderable = self._create_renderable()

        with pytest.raises(NotificationProviderError, match="Target .* is not a valid dataclass"):
            SlackNotificationProvider.send(target=target, renderable=renderable)

    @patch("sentry.notifications.platform.slack.provider.SlackSdkClient")
    def test_send_to_direct_message(self, mock_slack_client: Mock) -> None:
        """Test sending message to direct message (user)"""
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = {"ok": True, "ts": "1234567890.123456"}

        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_id="U1234567890",  # User ID format
            resource_type=NotificationTargetResourceType.DIRECT_MESSAGE,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        # Manually set the integration fields (prepare_targets is a stub)
        rpc_integration = integration_service.get_integration(integration_id=target.integration_id)
        rpc_org_integration = integration_service.get_organization_integration(
            integration_id=target.integration_id,
            organization_id=target.organization_id,
        )

        object.__setattr__(target, "integration", rpc_integration)
        object.__setattr__(target, "organization_integration", rpc_org_integration)

        renderable = self._create_renderable()

        SlackNotificationProvider.send(target=target, renderable=renderable)

        mock_client_instance.chat_postMessage.assert_called_once_with(
            channel="U1234567890", blocks=renderable["blocks"]
        )
