import abc
from typing import TYPE_CHECKING, Generic

from sentry.notifications.platform.types import NotificationProviderKey, NotificationRenderableT
from sentry.organizations.services.organization.model import RpcOrganizationSummary

if TYPE_CHECKING:
    from sentry.notifications.platform.renderer import NotificationRenderer


class NotificationProvider(abc.ABC, Generic[NotificationRenderableT]):
    """
    A base class for all notification providers.
    """

    def __init__(self) -> None:
        pass

    @property
    @abc.abstractmethod
    def key(self) -> NotificationProviderKey:
        """
        The `NotificationProviderKey` associated with this provider.
        """
        raise NotImplementedError("Must use a NotificationProviderKey")

    @classmethod
    @abc.abstractmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        """
        Returns `True` if the provider is available given the key word arguments.
        """
        return False

    @property
    @abc.abstractmethod
    def default_renderer(self) -> type["NotificationRenderer[NotificationRenderableT]"]:
        """
        Returns the default renderer for this provider.
        """
        raise NotImplementedError("Must implement a default renderer")
