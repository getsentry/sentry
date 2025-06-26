from __future__ import annotations

from enum import StrEnum
from typing import Any, Protocol

from sentry.integrations.types import ExternalProviderEnum


class NotificationCategory(StrEnum):
    """
    The category of notification to be sent.
    These categories are the broad groupings that users can manage in their settings.
    The exception is the `DEBUG` category, which is used for testing and development.
    """

    DEBUG = "debug"
    # TODO(ecosystem): Connect this to NotificationSettingEnum


class NotificationSource(StrEnum):
    """
    An unique identifier for each notification. Each source should map to one way a notification
    can be sent.
    """

    TEST = "test"


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


class NotificationTarget(Protocol):
    """
    All targets of the notification platform must adhere to this protocol.
    """

    is_prepared: bool
    provider_key: NotificationProviderKey
    resource_type: NotificationTargetResourceType
    resource_id: str
    specific_data: dict[str, Any] | None


class NotificationData(Protocol):
    """
    All data passing through the notification platform must adhere to this protocol.
    """

    category: NotificationCategory
    source: NotificationSource


# TODO(ecosystem): Replace this 'Any' with a concrete known template output.
type NotificationRenderedTemplate = Any


class NotificationTemplate[T: NotificationData](Protocol):
    """
    All templates of the notification platform must adhere to this protocol.
    """

    def process(self, *, data: T) -> NotificationRenderedTemplate: ...


class NotificationStrategy(Protocol):
    """
    A strategy for determining which targets to send a notification to.
    """

    def get_targets(self) -> list[NotificationTarget]: ...
