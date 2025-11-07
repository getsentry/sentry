from sentry.integrations.types import ExternalProviders
from sentry.notifications.platform.types import NotificationProviderKey
from sentry.testutils.cases import TestCase


class NotificationsDjangoAppTest(TestCase):

    def test_registers_legacy_providers(self) -> None:
        from sentry.notifications.notify import registry

        assert len(registry) == 3
        assert registry[ExternalProviders.EMAIL] is not None
        assert registry[ExternalProviders.SLACK] is not None
        assert registry[ExternalProviders.MSTEAMS] is not None

    def test_registers_platform_providers(self) -> None:
        from sentry.notifications.platform.registry import provider_registry

        assert len(provider_registry.registrations) == 4
        assert provider_registry.get(NotificationProviderKey.DISCORD) is not None
        assert provider_registry.get(NotificationProviderKey.EMAIL) is not None
        assert provider_registry.get(NotificationProviderKey.MSTEAMS) is not None
        assert provider_registry.get(NotificationProviderKey.SLACK) is not None
