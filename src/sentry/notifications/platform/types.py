from __future__ import annotations

from enum import StrEnum
from typing import Any, Final, Protocol

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


# TODO(ecosystem): Evaluate whether or not this even makes sense as a protocol, or we can just use a typed Callable.
# If there is only one method, and the class usage is just to call a method, the Callable route might make more sense.
# The typing T is also sketchy being in only the return position, and not inherently connected to the provider class.
# The concept of renderers could just be a subset of functionality on the base provider class.
class NotificationRenderer[RenderableT, DataT: NotificationData](Protocol):
    """
    A protocol metaclass for all notification renderers.
    RenderableT is a type that matches the connected provider.
    """

    provider_key: NotificationProviderKey

    def __init__(self, *, data: DataT):
        self.data: Final[DataT] = data

    def render(self, *, template: NotificationTemplate[DataT]) -> RenderableT:
        """
        Convert template, and data into a renderable object.
        The form of the renderable object is defined by the provider.
        """
        ...
