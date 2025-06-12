import abc
from typing import Generic, cast

from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.types import NotificationProviderKey, NotificationRenderableT


class NotificationRenderer(abc.ABC, Generic[NotificationRenderableT]):
    """
    A base class for all notification providers.
    """

    provider: NotificationProvider[NotificationRenderableT]

    @property
    @abc.abstractmethod
    def provider_key(self) -> NotificationProviderKey:
        """
        The `NotificationProviderKey` associated with this provider.
        """
        raise NotImplementedError("Must use a NotificationProviderKey")

    def __init__(self) -> None:
        self.provider = cast(
            NotificationProvider[NotificationRenderableT], provider_registry.get(self.provider_key)
        )
