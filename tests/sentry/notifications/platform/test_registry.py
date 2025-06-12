from sentry.notifications.platform.discord.provider import DiscordNotificationProvider
from sentry.notifications.platform.email.provider import EmailNotificationProvider
from sentry.notifications.platform.msteams.provider import MSTeamsNotificationProvider
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.slack.provider import SlackNotificationProvider
from sentry.testutils.cases import TestCase


class NotificationProviderRegistryTest(TestCase):
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
