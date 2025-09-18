from typing import Any, TypeGuard
from unittest.mock import Mock, patch

import pytest

from sentry.integrations.discord.message_builder.base.component.action_row import (
    DiscordActionRowDict,
)
from sentry.integrations.discord.message_builder.base.component.base import (
    DiscordMessageComponentDict,
)
from sentry.integrations.discord.message_builder.base.component.button import DiscordButtonDict
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.platform.discord.provider import (
    DiscordNotificationProvider,
    DiscordRenderable,
)
from sentry.notifications.platform.provider import NotificationProviderError
from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
)


def is_action_row(component: DiscordMessageComponentDict) -> TypeGuard[DiscordActionRowDict]:
    """Type guard to check if component is an action row."""
    return component.get("type") == 1


def is_button(component: DiscordMessageComponentDict) -> TypeGuard[DiscordButtonDict]:
    """Type guard to check if component is a button."""
    return component.get("type") == 2


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
        assert is_action_row(action_row)
        assert len(action_row["components"]) == 1

        button = action_row["components"][0]
        assert is_button(button)
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
        assert is_action_row(action_row)  # Type guard
        buttons = action_row["components"]
        assert len(buttons) == 3

        # Test button properties
        button_0 = buttons[0]
        assert is_button(button_0)
        assert button_0["label"] == "Action 1"
        assert button_0["url"] == "https://example1.com"
        assert button_0["custom_id"] == "action_1"

        button_1 = buttons[1]
        assert is_button(button_1)
        assert button_1["label"] == "Action 2"
        assert button_1["url"] == "https://example2.com"
        assert button_1["custom_id"] == "action_2"

        button_2 = buttons[2]
        assert is_button(button_2)
        assert button_2["label"] == "Complex Action Name"
        assert button_2["url"] == "https://example3.com"
        assert button_2["custom_id"] == "complex_action_name"


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


class DiscordNotificationProviderValidateTargetTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.DISCORD,
            organization=self.organization,
            user=self.user,
            name="test-discord",
            metadata={"guild_id": "123456789", "guild_name": "Test Guild"},
        )

    def _create_target(
        self,
        resource_id: str = "987654321",
        resource_type: NotificationTargetResourceType = NotificationTargetResourceType.CHANNEL,
        integration: Any = None,
    ) -> IntegrationNotificationTarget:
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.DISCORD,
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

    @patch("sentry.notifications.platform.discord.provider.validate_integration_for_target")
    def test_validate_target_success(self, mock_validate_integration: Mock) -> None:
        """Test successful validation with valid integration and channel"""
        mock_validate_integration.return_value = None  # Integration validation passes

        target = self._create_target()

        # Should not raise any exceptions
        DiscordNotificationProvider.validate_target(target=target)

        mock_validate_integration.assert_called_once_with(target=target)

    def test_validate_target_invalid_target_class(self) -> None:
        """Test validation fails with wrong target class"""
        target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.DISCORD,
            resource_id="test@example.com",
            resource_type=NotificationTargetResourceType.EMAIL,
        )

        with pytest.raises(NotificationProviderError, match="Target .* is not a valid dataclass"):
            DiscordNotificationProvider.validate_target(target=target)

    def test_validate_target_wrong_provider_key(self) -> None:
        """Test validation fails with wrong provider key"""
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,  # Wrong provider
            resource_id="987654321",
            resource_type=NotificationTargetResourceType.CHANNEL,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        with pytest.raises(NotificationProviderError, match="Target intended for 'slack' provider"):
            DiscordNotificationProvider.validate_target(target=target)

    def test_validate_target_unsupported_resource_type(self) -> None:
        """Test validation fails with unsupported resource type"""
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.DISCORD,
            resource_id="test@example.com",
            resource_type=NotificationTargetResourceType.EMAIL,  # Not supported by Discord
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        with pytest.raises(
            NotificationProviderError, match="Target with resource type 'email' is not supported"
        ):
            DiscordNotificationProvider.validate_target(target=target)


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
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.DISCORD,
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

    @patch("sentry.notifications.platform.discord.provider.DiscordClient")
    def test_send_success(self, mock_discord_client: Mock) -> None:
        """Test successful message sending"""
        mock_client_instance = mock_discord_client.return_value
        mock_client_instance.send_message.return_value = {"id": "1234567890123456789"}

        target = self._create_target()
        renderable = self._create_renderable()

        DiscordNotificationProvider.send(target=target, renderable=renderable)

        mock_client_instance.send_message.assert_called_once_with("987654321", renderable)

    @patch("sentry.notifications.platform.discord.provider.DiscordClient")
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

        # Manually set the integration fields (prepare_targets is a stub)
        rpc_integration = integration_service.get_integration(integration_id=target.integration_id)
        rpc_org_integration = integration_service.get_organization_integration(
            integration_id=target.integration_id,
            organization_id=target.organization_id,
        )

        object.__setattr__(target, "integration", rpc_integration)
        object.__setattr__(target, "organization_integration", rpc_org_integration)

        renderable = self._create_renderable()

        DiscordNotificationProvider.send(target=target, renderable=renderable)

        mock_client_instance.send_message.assert_called_once_with("123456789012345678", renderable)
