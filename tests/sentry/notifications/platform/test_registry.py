from sentry.notifications.platform.discord.provider import DiscordNotificationProvider
from sentry.notifications.platform.email.provider import EmailNotificationProvider
from sentry.notifications.platform.msteams.provider import MSTeamsNotificationProvider
from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackNotificationProvider
from sentry.testutils.cases import TestCase


class NotificationProviderRegistryTest(TestCase):
    def test_all_registrants_are_valid(self):
        for provider in provider_registry.get_all():
            with self.subTest(provider=provider):
                # Ensures the provider can be instantiated, does not test functionality
                provider_instance = provider()

                # Ensures the provider inherits from base provider
                assert isinstance(provider_instance, NotificationProvider)

                # Ensures the provider's default renderer inherits from base renderer
                assert isinstance(provider_instance.default_renderer, NotificationRenderer)

    def test_get_all(self):
        providers = provider_registry.get_all()
        expected_providers = [
            EmailNotificationProvider,
            SlackNotificationProvider,
            MSTeamsNotificationProvider,
            DiscordNotificationProvider,
        ]

        assert len(providers) == len(expected_providers)
        for provider in expected_providers:
            assert provider in providers

    def test_get_available(self):
        providers = provider_registry.get_available()
        expected_providers = [EmailNotificationProvider]

        assert len(providers) == len(expected_providers)
        for provider in expected_providers:
            assert provider in providers
