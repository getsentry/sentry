from sentry.platform_example.notification_provider import NotificationProvider


class ProviderRegistry:
    registry: dict[str, NotificationProvider] = {}

    @staticmethod
    def register_provider(provider: NotificationProvider, provider_name: str) -> None:
        ProviderRegistry.registry[provider_name] = provider

    @staticmethod
    def get_provider(provider_name: str) -> NotificationProvider:
        return ProviderRegistry.registry[provider_name]
