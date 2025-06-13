from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.types import NotificationProviderKey
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
