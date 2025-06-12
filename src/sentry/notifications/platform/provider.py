import abc
from enum import StrEnum
from typing import TYPE_CHECKING, Generic

from sentry.integrations.types import ExternalProviderEnum
from sentry.notifications.platform.types import NotificationRenderable
from sentry.organizations.services.organization.model import RpcOrganizationSummary

if TYPE_CHECKING:
    from sentry.notifications.platform.renderer import NotificationRenderer


class NotificationProviderKey(StrEnum):
    """
    The unique keys for each registered notification provider.
    """

    EMAIL = ExternalProviderEnum.EMAIL
    SLACK = ExternalProviderEnum.SLACK
    MSTEAMS = ExternalProviderEnum.MSTEAMS
    DISCORD = ExternalProviderEnum.DISCORD


class NotificationProvider(abc.ABC, Generic[NotificationRenderable]):
    """
    A base class for all notification providers.
    """

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
    def default_renderer(self) -> type["NotificationRenderer[NotificationRenderable]"]:
        """
        Returns the default renderer for this provider.
        """
        raise NotImplementedError("Must implement a default renderer")
