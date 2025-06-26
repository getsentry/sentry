from typing import Any

import pytest

from sentry.notifications.platform.provider import NotificationProvider, NotificationProviderError
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.organizations.services.organization.serial import serialize_organization_summary
from sentry.testutils.cases import TestCase


class NotificationProviderTest(TestCase):
    def setUp(self):
        self.slack_integration = self.create_integration(
            organization=self.organization, provider="slack", external_id="ext-123"
        )
        self.discord_integration = self.create_integration(
            organization=self.organization, provider="discord", external_id="ext-123"
        )

    def test_all_registrants_follow_protocol(self):
        for provider in provider_registry.get_all():
            # Ensures the provider can be instantiated, does not test functionality
            provider()
            # Ensures protocol properties are present and correct
            assert provider.key in NotificationProviderKey
            assert issubclass(provider.target_class, GenericNotificationTarget)
            for resource_type in provider.target_resource_types:
                assert resource_type in NotificationTargetResourceType
            # Ensures the default renderer links back to its connected provider key
            assert provider.default_renderer == provider.get_renderer(
                category=NotificationCategory.DEBUG
            )
            assert isinstance(provider.is_available(), bool)
            assert isinstance(
                provider.is_available(
                    organization=serialize_organization_summary(self.organization)
                ),
                bool,
            )

    def test_validate_target_class(self):
        class TestDiscordProvider(NotificationProvider[Any]):
            key = NotificationProviderKey.DISCORD
            target_class = IntegrationNotificationTarget
            target_resource_types = [
                NotificationTargetResourceType.CHANNEL,
                NotificationTargetResourceType.DIRECT_MESSAGE,
            ]

        with pytest.raises(
            NotificationProviderError,
            match="Target 'GenericNotificationTarget' is not a valid dataclass for TestDiscordProvider",
        ):
            TestDiscordProvider.validate_target(
                target=GenericNotificationTarget(
                    provider_key=NotificationProviderKey.EMAIL,
                    resource_type=NotificationTargetResourceType.EMAIL,
                    resource_id="test@example.com",
                )
            )

        with pytest.raises(
            NotificationProviderError,
            match="Target intended for 'slack' provider was given to TestDiscordProvider",
        ):
            TestDiscordProvider.validate_target(
                target=IntegrationNotificationTarget(
                    provider_key=NotificationProviderKey.SLACK,
                    resource_type=NotificationTargetResourceType.EMAIL,
                    resource_id="test@example.com",
                    integration_id=self.slack_integration.id,
                    organization_id=self.organization.id,
                )
            )

        with pytest.raises(
            NotificationProviderError,
            match="Target with resource type 'email' is not supported by TestDiscordProvider"
            "Supported resource types: channel, direct_message",
        ):
            TestDiscordProvider.validate_target(
                target=IntegrationNotificationTarget(
                    provider_key=TestDiscordProvider.key,
                    resource_type=NotificationTargetResourceType.EMAIL,
                    resource_id="test@example.com",
                    integration_id=self.discord_integration.id,
                    organization_id=self.organization.id,
                )
            )

        # and finally, a valid target
        TestDiscordProvider.validate_target(
            target=IntegrationNotificationTarget(
                provider_key=TestDiscordProvider.key,
                resource_type=NotificationTargetResourceType.CHANNEL,
                resource_id="C01234567890",
                integration_id=self.discord_integration.id,
                organization_id=self.organization.id,
            )
        )
