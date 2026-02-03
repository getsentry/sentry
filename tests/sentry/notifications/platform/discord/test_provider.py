from typing import TypeGuard
from unittest.mock import Mock, patch

from sentry.integrations.discord.message_builder.base.component.action_row import (
    DiscordActionRowDict,
)
from sentry.integrations.discord.message_builder.base.component.base import (
    DiscordMessageComponentDict,
)
from sentry.integrations.discord.message_builder.base.component.button import (
    DiscordButtonDict,
    DiscordButtonStyle,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.platform.discord.provider import (
    DiscordNotificationProvider,
    DiscordRenderable,
)
from sentry.notifications.platform.target import IntegrationNotificationTarget


def is_action_row(component: DiscordMessageComponentDict) -> TypeGuard[DiscordActionRowDict]:
    """Type guard to check if component is an action row."""
    return component.get("type") == 1


def is_button(component: DiscordMessageComponentDict) -> TypeGuard[DiscordButtonDict]:
    """Type guard to check if component is a button."""
    return component.get("type") == 2


def assert_button_properties(
    button: DiscordMessageComponentDict,
    expected_label: str,
    expected_url: str,
) -> None:
    """Helper function to assert discord link button properties."""
    assert is_button(button)
    assert button["label"] == expected_label
    assert button["url"] == expected_url
    assert button["style"] == DiscordButtonStyle.LINK


from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification, MockNotificationTemplate


class DiscordRendererTest(TestCase):
    def test_default_renderer(self) -> None:
        data = MockNotification(message="test")
        template = MockNotificationTemplate()
        rendered_template = template.render(data)
        renderer = DiscordNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        renderable = renderer.render(data=data, rendered_template=rendered_template)

        # Test basic structure
        assert "content" in renderable
        assert "embeds" in renderable
        assert "components" in renderable

        # Test embed content
        embeds = renderable["embeds"]
        assert len(embeds) == 1
        embed = embeds[0]
        description = embed["description"]
        assert description == "\ntest"
        assert embed["title"] == "Mock Notification"
        assert embed["footer"]["text"] == "This is a mock footer"
        assert (
            embed["image"]["url"]
            == "https://raw.githubusercontent.com/knobiknows/all-the-bufo/main/all-the-bufo/bufo-pog.png"
        )

        # Test components (action buttons)
        components = renderable["components"]
        assert len(components) == 1

        action_row = components[0]
        assert is_action_row(action_row)
        assert len(action_row["components"]) == 1

        button = action_row["components"][0]
        assert_button_properties(button, "Visit Sentry", "https://www.sentry.io")

    def test_renderer_without_chart(self) -> None:
        """Test rendering when no chart is provided"""
        from sentry.notifications.platform.types import (
            NotificationBodyFormattingBlockType,
            NotificationBodyTextBlockType,
            NotificationRenderedAction,
            NotificationRenderedTemplate,
            ParagraphBlock,
            PlainTextBlock,
        )

        rendered_template = NotificationRenderedTemplate(
            subject="Test Without Chart",
            body=[
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text="test without chart",
                        )
                    ],
                )
            ],
            actions=[
                NotificationRenderedAction(label="Visit Sentry", link="https://www.sentry.io")
            ],
            footer="Test footer",
            chart=None,  # No chart
        )

        data = MockNotification(message="test without chart")
        renderer = DiscordNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        renderable = renderer.render(data=data, rendered_template=rendered_template)

        embed = renderable["embeds"][0]
        assert "image" not in embed or embed.get("image") is None

    def test_renderer_without_footer(self) -> None:
        """Test rendering when no footer is provided"""
        from sentry.notifications.platform.types import (
            NotificationBodyFormattingBlockType,
            NotificationBodyTextBlockType,
            NotificationRenderedAction,
            NotificationRenderedImage,
            NotificationRenderedTemplate,
            ParagraphBlock,
            PlainTextBlock,
        )

        rendered_template = NotificationRenderedTemplate(
            subject="Test Without Footer",
            body=[
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text="test without footer",
                        )
                    ],
                )
            ],
            actions=[
                NotificationRenderedAction(label="Visit Sentry", link="https://www.sentry.io")
            ],
            footer=None,  # No footer
            chart=NotificationRenderedImage(
                url="https://example.com/chart.png",
                alt_text="Test Chart",
            ),
        )

        data = MockNotification(message="test without footer")
        renderer = DiscordNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        renderable = renderer.render(data=data, rendered_template=rendered_template)

        embed = renderable["embeds"][0]
        assert "footer" not in embed or embed.get("footer") is None

    def test_renderer_without_actions(self) -> None:
        """Test rendering when no actions are provided"""
        from sentry.notifications.platform.types import (
            NotificationBodyFormattingBlockType,
            NotificationBodyTextBlockType,
            NotificationRenderedImage,
            NotificationRenderedTemplate,
            ParagraphBlock,
            PlainTextBlock,
        )

        rendered_template = NotificationRenderedTemplate(
            subject="Test Without Actions",
            body=[
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text="test without actions",
                        )
                    ],
                )
            ],
            actions=[],  # No actions
            footer="Test footer",
            chart=NotificationRenderedImage(
                url="https://example.com/chart.png",
                alt_text="Test Chart",
            ),
        )

        data = MockNotification(message="test without actions")
        renderer = DiscordNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        renderable = renderer.render(data=data, rendered_template=rendered_template)

        # Should have no components when no actions
        components = renderable["components"]
        assert len(components) == 0

    def test_renderer_multiple_actions(self) -> None:
        """Test rendering with multiple action buttons"""
        from sentry.notifications.platform.types import (
            NotificationBodyFormattingBlockType,
            NotificationBodyTextBlockType,
            NotificationRenderedAction,
            NotificationRenderedImage,
            NotificationRenderedTemplate,
            ParagraphBlock,
            PlainTextBlock,
        )

        actions = [
            NotificationRenderedAction(label="Action 1", link="https://example1.com"),
            NotificationRenderedAction(label="Action 2", link="https://example2.com"),
            NotificationRenderedAction(label="Complex Action Name", link="https://example3.com"),
        ]

        # Create a custom rendered template with multiple actions
        rendered_template = NotificationRenderedTemplate(
            subject="Test Multiple Actions",
            body=[
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text="test with multiple actions",
                        )
                    ],
                )
            ],
            actions=actions,
            footer="Test footer",
            chart=NotificationRenderedImage(
                url="https://example.com/chart.png",
                alt_text="Test Chart",
            ),
        )

        data = MockNotification(message="test with multiple actions")
        renderer = DiscordNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        renderable = renderer.render(data=data, rendered_template=rendered_template)

        components = renderable["components"]
        assert len(components) == 1

        action_row = components[0]
        assert is_action_row(action_row)  # Type guard
        buttons = action_row["components"]
        assert len(buttons) == 3

        # Test button properties
        assert_button_properties(buttons[0], "Action 1", "https://example1.com")
        assert_button_properties(buttons[1], "Action 2", "https://example2.com")
        assert_button_properties(buttons[2], "Complex Action Name", "https://example3.com")


class DiscordNotificationProviderTest(TestCase):
    def test_basic_fields(self) -> None:
        provider = DiscordNotificationProvider()
        assert provider.key == NotificationProviderKey.DISCORD
        assert provider.target_class == IntegrationNotificationTarget
        assert provider.target_resource_types == [
            NotificationTargetResourceType.CHANNEL,
            NotificationTargetResourceType.DIRECT_MESSAGE,
        ]

    def test_is_available(self) -> None:
        assert DiscordNotificationProvider.is_available() is False
        assert DiscordNotificationProvider.is_available(organization=self.organization) is False


class DiscordNotificationProviderSendTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.DISCORD,
            organization=self.organization,
            user=self.user,
            name="test-discord",
            metadata={"guild_id": "123456789", "guild_name": "Test Guild"},
        )

    def _create_target(self, resource_id: str = "987654321") -> IntegrationNotificationTarget:
        return IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.DISCORD,
            resource_id=resource_id,
            resource_type=NotificationTargetResourceType.CHANNEL,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

    def _create_renderable(self) -> DiscordRenderable:
        """Create a sample DiscordRenderable for testing"""
        from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
        from sentry.integrations.discord.message_builder.base.embed.base import DiscordMessageEmbed

        embed = DiscordMessageEmbed(
            title="Test Notification",
            description="This is a test message",
        )
        builder = DiscordMessageBuilder(embeds=[embed])
        return builder.build()

    @patch("sentry.integrations.discord.integration.DiscordClient")
    def test_send_success(self, mock_discord_client: Mock) -> None:
        """Test successful message sending"""
        mock_client_instance = mock_discord_client.return_value
        mock_client_instance.send_message.return_value = {"id": "1234567890123456789"}

        target = self._create_target()
        renderable = self._create_renderable()

        DiscordNotificationProvider.send(target=target, renderable=renderable)

        mock_client_instance.send_message.assert_called_once_with(
            channel_id="987654321", message=renderable
        )

    @patch("sentry.integrations.discord.integration.DiscordClient")
    def test_send_to_direct_message(self, mock_discord_client: Mock) -> None:
        """Test sending message to direct message (user)"""
        mock_client_instance = mock_discord_client.return_value
        mock_client_instance.send_message.return_value = {"id": "1234567890123456789"}

        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.DISCORD,
            resource_id="123456789012345678",  # User ID format
            resource_type=NotificationTargetResourceType.DIRECT_MESSAGE,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )
        renderable = self._create_renderable()

        DiscordNotificationProvider.send(target=target, renderable=renderable)

        mock_client_instance.send_message.assert_called_once_with(
            channel_id="123456789012345678", message=renderable
        )
