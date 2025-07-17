from sentry.notifications.platform.discord.provider import DiscordNotificationProvider
from sentry.notifications.platform.email.provider import EmailNotificationProvider
from sentry.notifications.platform.msteams.provider import MSTeamsNotificationProvider
from sentry.notifications.platform.registry import provider_registry, template_registry
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


class NotificationTemplateRegistryTest(TestCase):
    def test_template_categories(self):
        for template in template_registry.registrations.values():
            assert template.category, (
                f"Template {template!r} was registered without a category!\n"
                "Use NotificationCategory within the class to fix this test"
            )

    def test_template_source_matches_categories(self):
        for source, template in template_registry.registrations.items():
            assert source in template.category.get_sources(), (
                f"Template {template!r} was registered with an unknown source ({source})\n"
                f"Add the '{source}' to NOTIFICATION_SOURCE_MAP on '{template.category.value}' to fix this test."
            )
