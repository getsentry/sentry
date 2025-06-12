from typing import TYPE_CHECKING, Generic, Protocol

from sentry.notifications.platform.types import NotificationProviderKey, NotificationRenderableT
from sentry.organizations.services.organization.model import RpcOrganizationSummary

if TYPE_CHECKING:
    from sentry.notifications.platform.renderer import NotificationRenderer


class NotificationProvider(Protocol, Generic[NotificationRenderableT]):
    """
    A protocol metaclass for all notification providers.
    """

    key: NotificationProviderKey
    default_renderer: type["NotificationRenderer[NotificationRenderableT]"]

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        """
        Returns `True` if the provider is available given the key word arguments.
        """
        ...
