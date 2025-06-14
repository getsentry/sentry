from enum import StrEnum
from typing import Any

from sentry.integrations.types import ExternalProviderEnum


class NotificationProviderKey(StrEnum):
    """
    The unique keys for each registered notification provider.
    """

    EMAIL = ExternalProviderEnum.EMAIL
    SLACK = ExternalProviderEnum.SLACK
    MSTEAMS = ExternalProviderEnum.MSTEAMS
    DISCORD = ExternalProviderEnum.DISCORD


class NotificationTargetResourceType(StrEnum):
    """
    Avenues for a notification to be sent to that can be understood by a provider.
    """

    EMAIL = "email"
    CHANNEL = "channel"
    DIRECT_MESSAGE = "direct_message"


type NotificationTemplate = Any
type NotificationData = Any


class NotificationType(StrEnum):
    """
    The type of notification to be sent.
    """

    DEBUG = "debug"
