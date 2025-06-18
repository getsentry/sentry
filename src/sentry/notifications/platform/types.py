from enum import StrEnum
from typing import Protocol

from sentry.integrations.types import ExternalProviderEnum
from sentry.notifications.platform.target import NotificationTarget


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


class NotificationCategory(StrEnum):
    """
    The category of notification to be sent.
    These categories are the broad groupings that users can manage in their settings.
    The exception is the `DEBUG` category, which is used for internal testing and development.
    """

    DEBUG = "debug"
    # TODO(ecosystem): Connect this to NotificationSettingEnum


class NotificationData(Protocol):
    category: NotificationCategory
    thread_id: str | None = None
    pass


class NotificationTemplate[T: NotificationData]:
    pass


class NotificationStrategy(Protocol):
    """
    A strategy for determining which targets to send a notification to.
    """

    def get_targets(self) -> list[NotificationTarget]:
        pass
