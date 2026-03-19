from unittest.mock import Mock, patch

import pytest
from slack_sdk.errors import SlackApiError
from slack_sdk.models.blocks import (
    HeaderBlock,
    MarkdownTextObject,
    PlainTextObject,
    SectionBlock,
)
from slack_sdk.web import SlackResponse

from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.models.notificationthread import NotificationThread
from sentry.notifications.platform.provider import (
    NotificationProviderError,
    SendFailure,
    SendResult,
    SendStatus,
)
from sentry.notifications.platform.slack.provider import SlackNotificationProvider, SlackRenderable
from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
)
from sentry.notifications.platform.threading import ThreadContext, ThreadKey
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationSource,
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
        """Test successful message sending returns SendResult"""
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = {"ok": True, "ts": "1234567890.123456"}

        target = self._create_target()
        renderable = self._create_renderable()

        result = SlackNotificationProvider.send(target=target, renderable=renderable)

        assert isinstance(result, SendResult)
        assert result.provider_message_id is None
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


class SlackNotificationProviderThreadingTest(TestCase):
    """Tests for _send_with_threading and threading-related send behavior."""

    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.SLACK,
            organization=self.organization,
            user=self.user,
            name="test-slack",
            metadata={"domain_name": "test-workspace.slack.com"},
        )
        self.thread_key = ThreadKey(
            key_type=NotificationSource.ERROR_ALERT,
            key_data={"action_id": "123", "group_id": "456"},
        )

    def _create_target(self, resource_id: str = "C1234567890") -> IntegrationNotificationTarget:
        return IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_id=resource_id,
            resource_type=NotificationTargetResourceType.CHANNEL,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

    def _create_renderable(self) -> SlackRenderable:
        return SlackRenderable(
            blocks=[
                HeaderBlock(text=PlainTextObject(text="Test Notification")),
                SectionBlock(text=MarkdownTextObject(text="This is a test message")),
            ],
            text="Test Notification",
        )

    def _create_existing_thread(
        self, thread_identifier: str = "1111111111.111111"
    ) -> NotificationThread:
        from sentry.notifications.platform.threading import ThreadingConfig, ThreadingService

        config: ThreadingConfig = {
            "key_type": NotificationSource.ERROR_ALERT,
            "key_data": {"rule_fire_history_id": 123, "rule_action_uuid": "abc-123"},
            "provider_key": NotificationProviderKey.SLACK,
            "target_id": "C1234567890",
            "thread_identifier": thread_identifier,
            "provider_data": None,
        }
        thread, _ = ThreadingService.store_new_thread(
            threading_config=config,
            external_message_id="first_msg_id",
        )
        return thread

    @patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_send_with_thread_context_existing_thread(self, mock_slack_client: Mock) -> None:
        """When thread_context has an existing thread, thread_ts is passed to the Slack API."""
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = SlackResponse(
            client=mock_client_instance,
            http_verb="POST",
            api_url="https://slack.com/api/chat.postMessage",
            req_args={},
            data={"ok": True, "ts": "2222222222.222222"},
            headers={},
            status_code=200,
        )

        existing_thread = self._create_existing_thread(thread_identifier="1111111111.111111")

        target = self._create_target()
        renderable = self._create_renderable()
        thread_context = ThreadContext(
            thread_key=self.thread_key,
            thread=existing_thread,
        )

        result = SlackNotificationProvider.send(
            target=target, renderable=renderable, thread_context=thread_context
        )

        assert isinstance(result, SendResult)
        assert result.provider_message_id == "2222222222.222222"

        mock_client_instance.chat_postMessage.assert_called_once_with(
            channel="C1234567890",
            blocks=renderable["blocks"],
            text=renderable["text"],
            thread_ts="1111111111.111111",
        )

    @patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_send_with_thread_context_reply_broadcast(self, mock_slack_client: Mock) -> None:
        """When reply_broadcast=True, it is passed to the Slack API."""
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = SlackResponse(
            client=mock_client_instance,
            http_verb="POST",
            api_url="https://slack.com/api/chat.postMessage",
            req_args={},
            data={"ok": True, "ts": "2222222222.222222"},
            headers={},
            status_code=200,
        )

        existing_thread = self._create_existing_thread(thread_identifier="1111111111.111111")

        target = self._create_target()
        renderable = self._create_renderable()
        thread_context = ThreadContext(
            thread_key=self.thread_key,
            thread=existing_thread,
            reply_broadcast=True,
        )

        result = SlackNotificationProvider.send(
            target=target, renderable=renderable, thread_context=thread_context
        )

        assert isinstance(result, SendResult)
        assert result.provider_message_id == "2222222222.222222"
        mock_client_instance.chat_postMessage.assert_called_once_with(
            channel="C1234567890",
            blocks=renderable["blocks"],
            text=renderable["text"],
            thread_ts="1111111111.111111",
            reply_broadcast=True,
        )

    @patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_send_with_thread_context_no_existing_thread(self, mock_slack_client: Mock) -> None:
        """When thread_context.thread is None (first message), sends without thread_ts."""
        mock_client_instance = mock_slack_client.return_value
        mock_client_instance.chat_postMessage.return_value = SlackResponse(
            client=mock_client_instance,
            http_verb="POST",
            api_url="https://slack.com/api/chat.postMessage",
            req_args={},
            data={"ok": True, "ts": "3333333333.333333"},
            headers={},
            status_code=200,
        )

        target = self._create_target()
        renderable = self._create_renderable()
        thread_context = ThreadContext(
            thread_key=self.thread_key,
            thread=None,
        )

        result = SlackNotificationProvider.send(
            target=target, renderable=renderable, thread_context=thread_context
        )

        assert isinstance(result, SendResult)
        assert result.provider_message_id == "3333333333.333333"
        mock_client_instance.chat_postMessage.assert_called_once_with(
            channel="C1234567890",
            blocks=renderable["blocks"],
            text=renderable["text"],
        )

    @patch("sentry.integrations.slack.integration.SlackSdkClient")
    def test_send_with_threading_slack_api_error(self, mock_slack_client: Mock) -> None:
        """On SlackApiError, SendResult contains error details."""
        mock_client_instance = mock_slack_client.return_value
        error_response = SlackResponse(
            client=mock_client_instance,
            http_verb="POST",
            api_url="https://slack.com/api/chat.postMessage",
            req_args={},
            data={"ok": False, "error": "channel_not_found"},
            headers={},
            status_code=400,
        )
        mock_client_instance.chat_postMessage.side_effect = SlackApiError(
            message="channel_not_found", response=error_response
        )

        target = self._create_target()
        renderable = self._create_renderable()
        thread_context = ThreadContext(
            thread_key=self.thread_key,
            thread=None,
        )

        result = SlackNotificationProvider.send(
            target=target, renderable=renderable, thread_context=thread_context
        )

        assert isinstance(result, SendFailure)
        assert result.status == SendStatus.HALT
        assert result.error_code == 400
        assert result.exception is not None
        assert "channel_not_found" in str(result.exception)
