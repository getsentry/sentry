from typing import int
from unittest.mock import Mock, patch

from sentry.integrations.msteams.card_builder.block import (
    ADAPTIVE_CARD_SCHEMA_URL,
    CURRENT_CARD_VERSION,
    ActionType,
    TextSize,
    TextWeight,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.platform.msteams.provider import (
    MSTeamsNotificationProvider,
    MSTeamsRenderable,
)
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification, MockNotificationTemplate
from tests.sentry.integrations.msteams.test_message_builder import _is_open_url_action


class MSTeamsRendererTest(TestCase):
    def test_default_renderer(self) -> None:
        data = MockNotification(message="test")
        template = MockNotificationTemplate()
        rendered_template = template.render(data)
        renderer = MSTeamsNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        renderable = renderer.render(data=data, rendered_template=rendered_template)

        # Verify the basic structure of the AdaptiveCard
        assert renderable["type"] == "AdaptiveCard"
        assert renderable["version"] == CURRENT_CARD_VERSION
        assert renderable["$schema"] == ADAPTIVE_CARD_SCHEMA_URL
        assert "body" in renderable

        body_blocks = renderable["body"]
        assert len(body_blocks) == 5  # title, body, actions, chart, footer

        # Verify title block
        title_block = body_blocks[0]
        assert title_block["type"] == "TextBlock"
        assert title_block["text"] == "Mock Notification"
        assert title_block["size"] == TextSize.LARGE
        assert title_block["weight"] == TextWeight.BOLDER

        # Verify body block
        body_block = body_blocks[1]
        assert body_block["type"] == "TextBlock"
        assert body_block["text"] == "test"

        # Verify actions block
        actions_block = body_blocks[2]
        assert actions_block["type"] == "ActionSet"
        assert len(actions_block["actions"]) == 1
        action = actions_block["actions"][0]
        assert action["type"] == ActionType.OPEN_URL
        assert action["title"] == "Visit Sentry"
        assert action["url"] == "https://www.sentry.io"

        # Verify chart image block
        chart_block = body_blocks[3]
        assert chart_block["type"] == "Image"
        assert (
            chart_block["url"]
            == "https://raw.githubusercontent.com/knobiknows/all-the-bufo/main/all-the-bufo/bufo-pog.png"
        )
        assert chart_block["altText"] == "Bufo Pog"

        # Verify footer block
        footer_block = body_blocks[4]
        assert footer_block["type"] == "TextBlock"
        assert footer_block["text"] == "This is a mock footer"
        assert footer_block["size"] == TextSize.SMALL

    def test_renderer_without_chart(self) -> None:
        data = MockNotification(message="test")
        template = MockNotificationTemplate()
        base_template = template.render(data)
        # Override to remove chart
        rendered_template = NotificationRenderedTemplate(
            subject=base_template.subject,
            body=base_template.body,
            actions=base_template.actions,
            footer=base_template.footer,
            chart=None,  # No chart
        )
        renderer = MSTeamsNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        renderable = renderer.render(data=data, rendered_template=rendered_template)

        body_blocks = renderable["body"]
        assert len(body_blocks) == 4  # title, body, actions, footer (no chart)

        # Verify no chart block is present
        block_types = [block["type"] for block in body_blocks]
        assert "Image" not in block_types

    def test_renderer_without_footer(self) -> None:
        data = MockNotification(message="test")
        template = MockNotificationTemplate()
        base_template = template.render(data)
        # Override to remove footer
        rendered_template = NotificationRenderedTemplate(
            subject=base_template.subject,
            body=base_template.body,
            actions=base_template.actions,
            footer=None,  # No footer
            chart=base_template.chart,
        )
        renderer = MSTeamsNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        renderable = renderer.render(data=data, rendered_template=rendered_template)

        body_blocks = renderable["body"]
        assert len(body_blocks) == 4  # title, body, actions, chart (no footer)

        # Verify no footer block with size="small" is present
        small_text_blocks = [
            block
            for block in body_blocks
            if block.get("type") == "TextBlock" and block.get("size") == TextSize.SMALL
        ]
        assert len(small_text_blocks) == 0

    def test_renderer_without_actions(self) -> None:
        data = MockNotification(message="test")
        template = MockNotificationTemplate()
        base_template = template.render(data)
        # Override to remove actions
        rendered_template = NotificationRenderedTemplate(
            subject=base_template.subject,
            body=base_template.body,
            actions=[],  # No actions
            footer=base_template.footer,
            chart=base_template.chart,
        )
        renderer = MSTeamsNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        renderable = renderer.render(data=data, rendered_template=rendered_template)

        body_blocks = renderable["body"]
        assert len(body_blocks) == 4  # title, body,  chart, footer

        # Verify no footer block with size="small" is present
        action_blocks = [block for block in body_blocks if block.get("type") == "ActionSet"]
        assert len(action_blocks) == 0

    def test_renderer_multiple_actions(self) -> None:
        data = MockNotification(message="test")
        template = MockNotificationTemplate()
        base_template = template.render(data)
        # Override with multiple actions
        rendered_template = NotificationRenderedTemplate(
            subject=base_template.subject,
            body=base_template.body,
            actions=[
                NotificationRenderedAction(
                    label="Visit Sentry",
                    link="https://www.sentry.io",
                ),
                NotificationRenderedAction(
                    label="View Documentation",
                    link="https://docs.sentry.io",
                ),
                NotificationRenderedAction(
                    label="Contact Support",
                    link="https://help.sentry.io",
                ),
            ],
            footer=None,
            chart=None,
        )
        renderer = MSTeamsNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        renderable = renderer.render(data=data, rendered_template=rendered_template)

        body_blocks = renderable["body"]
        actions_block = body_blocks[2]
        assert actions_block["type"] == "ActionSet"
        assert len(actions_block["actions"]) == 3

        # Verify all actions
        actions = actions_block["actions"]

        assert _is_open_url_action(actions[0])
        assert actions[0]["title"] == "Visit Sentry"
        assert actions[0]["url"] == "https://www.sentry.io"

        assert _is_open_url_action(actions[1])
        assert actions[1]["title"] == "View Documentation"
        assert actions[1]["url"] == "https://docs.sentry.io"

        assert _is_open_url_action(actions[2])
        assert actions[2]["title"] == "Contact Support"
        assert actions[2]["url"] == "https://help.sentry.io"


class MSTeamsNotificationProviderTest(TestCase):
    def test_basic_fields(self) -> None:
        provider = MSTeamsNotificationProvider()
        assert provider.key == NotificationProviderKey.MSTEAMS
        assert provider.target_class == IntegrationNotificationTarget
        assert provider.target_resource_types == [
            NotificationTargetResourceType.CHANNEL,
            NotificationTargetResourceType.DIRECT_MESSAGE,
        ]

    def test_is_available(self) -> None:
        assert MSTeamsNotificationProvider.is_available() is False
        assert MSTeamsNotificationProvider.is_available(organization=self.organization) is False


class MSTeamsNotificationProviderSendTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.MSTEAMS,
            organization=self.organization,
            user=self.user,
            name="test-msteams",
            metadata={"service_url": "https://test.msteams.com", "team_id": "test-team-id"},
        )

    def _create_target(
        self, resource_id: str = "19:test-channel@thread.skype"
    ) -> IntegrationNotificationTarget:
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.MSTEAMS,
            resource_id=resource_id,
            resource_type=NotificationTargetResourceType.CHANNEL,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        return target

    def _create_renderable(self) -> MSTeamsRenderable:
        """Create a sample MSTeamsRenderable for testing"""
        from sentry.integrations.msteams.card_builder.block import (
            ADAPTIVE_CARD_SCHEMA_URL,
            CURRENT_CARD_VERSION,
            create_text_block,
        )

        return {
            "type": "AdaptiveCard",
            "body": [
                create_text_block(text="Test Notification"),
                create_text_block(text="This is a test message"),
            ],
            "version": CURRENT_CARD_VERSION,
            "$schema": ADAPTIVE_CARD_SCHEMA_URL,
        }

    @patch("sentry.integrations.msteams.integration.MsTeamsClient")
    def test_send_success(self, mock_msteams_client: Mock) -> None:
        """Test successful message sending"""
        mock_client_instance = mock_msteams_client.return_value
        mock_client_instance.send_card.return_value = {"id": "1234567890"}

        target = self._create_target()
        renderable = self._create_renderable()

        MSTeamsNotificationProvider.send(target=target, renderable=renderable)

        mock_client_instance.send_card.assert_called_once_with(
            conversation_id="19:test-channel@thread.skype", card=renderable
        )

    @patch("sentry.integrations.msteams.integration.MsTeamsClient")
    def test_send_to_direct_message(self, mock_msteams_client: Mock) -> None:
        """Test sending message to direct message (user)"""
        mock_client_instance = mock_msteams_client.return_value
        mock_client_instance.send_card.return_value = {"id": "1234567890"}

        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.MSTEAMS,
            resource_id="29:test-user-id",  # User conversation ID format
            resource_type=NotificationTargetResourceType.DIRECT_MESSAGE,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        renderable = self._create_renderable()

        MSTeamsNotificationProvider.send(target=target, renderable=renderable)

        mock_client_instance.send_card.assert_called_once_with(
            conversation_id="29:test-user-id", card=renderable
        )
