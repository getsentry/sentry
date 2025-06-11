import abc
from enum import StrEnum
from typing import Generic

from sentry.notifications.platform.renderer import NotificationRenderable, NotificationRenderer
from sentry.organizations.services.organization.model import RpcOrganizationSummary

"""
A renderable object that is understood by the notification provider.
For example, Email might expect HTML, or raw text; Slack might expect a JSON Block Kit object.
"""


class NotificationProviderKey(StrEnum):
    """
    The unique keys for each registered notification provider.
    """

    EMAIL = "email"
    SLACK = "slack"
    MSTEAMS = "msteams"
    DISCORD = "discord"


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
    def default_renderer(self) -> type[NotificationRenderer]:
        """
        Returns the default renderer for this provider.
        """
        raise NotImplementedError("Must implement a default renderer")
