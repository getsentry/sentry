from sentry.notifications.platform.discord.provider import DiscordNotificationProvider
from sentry.notifications.platform.email.provider import EmailNotificationProvider
from sentry.notifications.platform.msteams.provider import MSTeamsNotificationProvider
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.slack.provider import SlackNotificationProvider
from sentry.notifications.platform.types import NotificationTemplateKey
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
    debug_template_keys = {NotificationTemplateKey.DEBUG}

    def test_no_unknown_registration_keys(self):
        for template_key, template in template_registry.registrations.items():
            assert template_key in NotificationTemplateKey, (
                f"Template {template!r} was registered with an unknown key ({template_key})\n"
                "use NotificationTemplateKey within @template_registry.register() to fix this test."
            )

    def test_no_unused_production_keys(self):
        unused_keys: set[str] = set(NotificationTemplateKey)
        for template_key in template_registry.registrations.keys():
            if template_key in unused_keys:
                unused_keys.remove(template_key)

        # Remove the debug template keys, these are permitted to be unused in production.
        unused_production_keys = unused_keys - set(self.debug_template_keys)

        if unused_production_keys:
            raise AssertionError(
                f"Known NotificationTemplateKey(s) have no associated template registered: '{', '.join(unused_production_keys)}'\n"
                "Use @template_registry.register() to register them, or explicitly exclude these keys within this test."
            )
