from typing import Any, Generic, Protocol

from sentry.notifications.platform.types import NotificationProviderKey, NotificationRenderableT

type NotificationTemplate = Any
type NotificationData = Any


class NotificationRenderer(Protocol, Generic[NotificationRenderableT]):
    """
    A protocol metaclass for all notification providers.
    """

    provider_key: NotificationProviderKey

    def render(
        self, *, data: NotificationData, template: NotificationTemplate
    ) -> type["NotificationRenderableT"]:
        """
        Convert template, and data into a renderable object.
        The form of the renderable object is defined by the provider.
        """
        ...
