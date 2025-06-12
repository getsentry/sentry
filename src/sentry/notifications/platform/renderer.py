import abc
from typing import Generic

from sentry.notifications.platform.provider import NotificationProvider, NotificationProviderKey
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.types import NotificationRenderable


class NotificationRenderer(abc.ABC, Generic[NotificationRenderable]):
    """
    A base class for all notification providers.
    """

    provider: type[NotificationProvider[NotificationRenderable]]

    @property
    @abc.abstractmethod
    def provider_key(self) -> NotificationProviderKey:
        """
        The `NotificationProviderKey` associated with this provider.
        """
        raise NotImplementedError("Must use a NotificationProviderKey")

    def __init__(self) -> None:
        self.provider = provider_registry.get(self.provider_key)
