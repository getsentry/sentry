from sentry.notifications.platform.discord.provider import DiscordNotificationProvider
from sentry.notifications.platform.target import IntegrationNotificationTarget
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
        assert embed["title"] == "Mock Notification"
        assert embed["description"] == "test"
        assert embed["footer"]["text"] == "This is a mock footer"
        assert (
            embed["image"]["url"]
            == "https://raw.githubusercontent.com/knobiknows/all-the-bufo/main/all-the-bufo/bufo-pog.png"
        )

        # Test components (action buttons)
        components = renderable["components"]
        assert len(components) == 1

        action_row = components[0]
        assert action_row["type"] == 1  # ActionRow type
        assert len(action_row["components"]) == 1

        button = action_row["components"][0]
        assert button["type"] == 2  # Button type
        assert button["label"] == "Visit Sentry"
        assert button["url"] == "https://www.sentry.io"
        assert button["custom_id"] == "visit_sentry"

    def test_renderer_without_chart(self) -> None:
        """Test rendering when no chart is provided"""
        from sentry.notifications.platform.types import (
            NotificationRenderedAction,
            NotificationRenderedTemplate,
        )

        rendered_template = NotificationRenderedTemplate(
            subject="Test Without Chart",
            body="test without chart",
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
            NotificationRenderedAction,
            NotificationRenderedImage,
            NotificationRenderedTemplate,
        )

        rendered_template = NotificationRenderedTemplate(
            subject="Test Without Footer",
            body="test without footer",
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
            NotificationRenderedImage,
            NotificationRenderedTemplate,
        )

        rendered_template = NotificationRenderedTemplate(
            subject="Test Without Actions",
            body="test without actions",
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
            NotificationRenderedAction,
            NotificationRenderedImage,
            NotificationRenderedTemplate,
        )

        actions = [
            NotificationRenderedAction(label="Action 1", link="https://example1.com"),
            NotificationRenderedAction(label="Action 2", link="https://example2.com"),
            NotificationRenderedAction(label="Complex Action Name", link="https://example3.com"),
        ]

        # Create a custom rendered template with multiple actions
        rendered_template = NotificationRenderedTemplate(
            subject="Test Multiple Actions",
            body="test with multiple actions",
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
        buttons = action_row["components"]
        assert len(buttons) == 3

        # Test button properties
        assert buttons[0]["label"] == "Action 1"
        assert buttons[0]["url"] == "https://example1.com"
        assert buttons[0]["custom_id"] == "action_1"

        assert buttons[1]["label"] == "Action 2"
        assert buttons[1]["url"] == "https://example2.com"
        assert buttons[1]["custom_id"] == "action_2"

        assert buttons[2]["label"] == "Complex Action Name"
        assert buttons[2]["url"] == "https://example3.com"
        assert buttons[2]["custom_id"] == "complex_action_name"


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
