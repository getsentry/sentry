import abc
from enum import StrEnum
from typing import Generic, TypeVar

from sentry.organizations.services.organization.model import RpcOrganizationSummary

ProviderRenderable = TypeVar("ProviderRenderable")
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


class NotificationProvider(abc.ABC, Generic[ProviderRenderable]):
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
