from typing import int
from unittest.mock import Mock, patch

import pytest

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
            {
                "image_url": "https://raw.githubusercontent.com/knobiknows/all-the-bufo/main/all-the-bufo/bufo-pog.png",
                "alt_text": "Bufo Pog",
                "type": "image",
            },
            {
                "elements": [{"text": "This is a mock footer", "type": "mrkdwn"}],
                "type": "context",
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
            ],
            text="Test Notification",
        )

    @patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_send_success(self, mock_slack_client: Mock) -> None:
        """Test successful message sending"""
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = {"ok": True, "ts": "1234567890.123456"}

        target = self._create_target()
        renderable = self._create_renderable()

        SlackNotificationProvider.send(target=target, renderable=renderable)

        mock_client_instance.chat_postMessage.assert_called_once_with(
            channel="C1234567890", blocks=renderable["blocks"], text=renderable["text"]
        )

    def test_send_invalid_target_class(self) -> None:
        """Test send fails with invalid target class"""

        target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_id="test@example.com",
            resource_type=NotificationTargetResourceType.EMAIL,
        )
        renderable = self._create_renderable()

        with pytest.raises(
            NotificationProviderError,
            match="Target 'GenericNotificationTarget' is not a valid dataclass for SlackNotificationProvider",
        ):
            SlackNotificationProvider.send(target=target, renderable=renderable)

    @patch("sentry.integrations.slack.integration.SlackSdkClient")
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
        renderable = self._create_renderable()

        SlackNotificationProvider.send(target=target, renderable=renderable)

        mock_client_instance.chat_postMessage.assert_called_once_with(
            channel="U1234567890", blocks=renderable["blocks"], text=renderable["text"]
        )
