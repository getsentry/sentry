from enum import StrEnum
from typing import TypeVar

from sentry.integrations.types import ExternalProviderEnum


class NotificationProviderKey(StrEnum):
    """
    The unique keys for each registered notification provider.
    """

    EMAIL = ExternalProviderEnum.EMAIL
    SLACK = ExternalProviderEnum.SLACK
    MSTEAMS = ExternalProviderEnum.MSTEAMS
    DISCORD = ExternalProviderEnum.DISCORD


NotificationRenderableT = TypeVar("NotificationRenderableT")
"""
A renderable object that is understood by the notification provider.
For example, Email might expect HTML, or raw text; Slack might expect a JSON Block Kit object.
"""
NotificationRenderableT_co = TypeVar("NotificationRenderableT_co", covariant=True)
"""
A covariant type of NotificationRenderableT, used in the renderer to pass the correct type through
to the render method.
"""
