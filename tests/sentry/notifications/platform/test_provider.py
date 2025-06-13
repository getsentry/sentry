from typing import Any

import pytest

from sentry.notifications.platform.provider import NotificationProvider, NotificationProviderError
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.target import IntegrationNotificationTarget, NotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.organizations.services.organization.serial import serialize_organization_summary
from sentry.testutils.cases import TestCase


class NotificationProviderTest(TestCase):
    def test_all_registrants_follow_protocol(self):
        for provider in provider_registry.get_all():
            # Ensures the provider can be instantiated, does not test functionality
            provider()
            # Ensures protocol properties are present and correct
            assert provider.key in NotificationProviderKey
            # Ensures the default renderer links back to its connected provider key
            assert provider.default_renderer.provider_key == provider.key
            assert isinstance(provider.is_available(), bool)
            assert isinstance(
                provider.is_available(
                    organization=serialize_organization_summary(self.organization)
                ),
                bool,
            )

    def test_validate_target_class(self):
        class ExampleProvider(NotificationProvider[Any]):
            key = NotificationProviderKey.SLACK
            target_class = IntegrationNotificationTarget
            target_resource_types = [
                NotificationTargetResourceType.CHANNEL,
                NotificationTargetResourceType.DIRECT_MESSAGE,
            ]

        with pytest.raises(
            NotificationProviderError,
            match="Target 'NotificationTarget' is not a valid dataclass for ExampleProvider",
        ):
            ExampleProvider.validate_target(
                target=NotificationTarget(
                    provider_key=NotificationProviderKey.EMAIL,
                    resource_type=NotificationTargetResourceType.EMAIL,
                    resource_id="test@example.com",
                )
            )

        with pytest.raises(
            NotificationProviderError,
            match="Target intended for 'email' provider was given to ExampleProvider",
        ):
            ExampleProvider.validate_target(
                target=IntegrationNotificationTarget(
                    provider_key=NotificationProviderKey.EMAIL,
                    resource_type=NotificationTargetResourceType.EMAIL,
                    resource_id="test@example.com",
                    integration_id=self.integration.id,
                    organization_id=self.organization.id,
                )
            )

        with pytest.raises(
            NotificationProviderError,
            match="Target with resource type 'email' is not supported by ExampleProvider"
            "Supported resource types: channel, direct_message",
        ):
            ExampleProvider.validate_target(
                target=IntegrationNotificationTarget(
                    provider_key=ExampleProvider.key,
                    resource_type=NotificationTargetResourceType.EMAIL,
                    resource_id="test@example.com",
                    integration_id=self.integration.id,
                    organization_id=self.organization.id,
                )
            )

        # and finally, a valid target
        ExampleProvider.validate_target(
            target=IntegrationNotificationTarget(
                provider_key=ExampleProvider.key,
                resource_type=NotificationTargetResourceType.CHANNEL,
                resource_id="C01234567890",
                integration_id=self.integration.id,
                organization_id=self.organization.id,
            )
        )
