from sentry.integrations.types import ExternalProviders
from sentry.notifications.platform.types import NotificationProviderKey, NotificationSource
from sentry.testutils.cases import TestCase


class NotificationsDjangoAppTest(TestCase):
    def test_registers_legacy_providers(self) -> None:
        """
        This django app doesn't actually register these legacy providers because it would result
        in some circular breakages from all the __init__.py imports. We'll still test it here
        to make sure it doesn't break in the future.

        If this test is failing for you, ensure all `@register_notification_provider` decorators
        are triggered by an initialization import.
        """
        from sentry.notifications.notify import registry

        assert len(registry) == 4
        assert registry[ExternalProviders.EMAIL] is not None
        assert registry[ExternalProviders.SLACK] is not None
        assert registry[ExternalProviders.SLACK_STAGING] is not None
        assert registry[ExternalProviders.MSTEAMS] is not None

    def test_registers_platform_providers(self) -> None:
        from sentry.notifications.platform.registry import provider_registry

        assert len(provider_registry.registrations) == 5
        assert provider_registry.get(NotificationProviderKey.DISCORD) is not None
        assert provider_registry.get(NotificationProviderKey.EMAIL) is not None
        assert provider_registry.get(NotificationProviderKey.MSTEAMS) is not None
        assert provider_registry.get(NotificationProviderKey.SLACK) is not None
        assert provider_registry.get(NotificationProviderKey.SLACK_STAGING) is not None

    def test_registers_platform_renderers(self) -> None:
        """
        If this test is failing for you, ensure the module holding your `@renderer_registry.register`
        decorator is imported by `sentry.notifications.apps.Config.ready`.
        """
        from sentry.notifications.platform.registry import renderer_registry

        assert set(renderer_registry.registrations) == {
            (NotificationProviderKey.DISCORD, NotificationSource.ISSUE),
            (NotificationProviderKey.DISCORD, NotificationSource.METRIC_ALERT),
            (NotificationProviderKey.MSTEAMS, NotificationSource.ISSUE),
            (NotificationProviderKey.SLACK, NotificationSource.ISSUE),
            (NotificationProviderKey.SLACK, NotificationSource.METRIC_ALERT),
            (NotificationProviderKey.SLACK, NotificationSource.SEER_AGENT_ERROR),
            (NotificationProviderKey.SLACK, NotificationSource.SEER_AGENT_RESPONSE),
            (NotificationProviderKey.SLACK, NotificationSource.SEER_AGENT_WRITE_APPROVAL),
            (NotificationProviderKey.SLACK, NotificationSource.SEER_AUTOFIX_ERROR),
            (NotificationProviderKey.SLACK, NotificationSource.SEER_AUTOFIX_SUCCESS),
            (NotificationProviderKey.SLACK, NotificationSource.SEER_AUTOFIX_TRIGGER),
            (NotificationProviderKey.SLACK, NotificationSource.SEER_AUTOFIX_UPDATE),
        }
