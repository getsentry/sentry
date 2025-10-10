from __future__ import annotations

import abc
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Protocol

from sentry.integrations.types import ExternalProviderEnum


class NotificationCategory(StrEnum):
    """
    The category of notification to be sent.
    These categories are the broad groupings that users can manage in their settings.
    The exception is the `DEBUG` category, which is used for testing and development.
    """

    # TODO(ecosystem): Connect this to NotificationSettingEnum
    DEBUG = "debug"

    def get_sources(self) -> list[str]:
        return NOTIFICATION_SOURCE_MAP[self]


NOTIFICATION_SOURCE_MAP = {
    NotificationCategory.DEBUG: [
        "test",
        "error-alert-service",
        "deployment-service",
        "slow-load-metric-alert",
        "performance-monitoring",
        "team-communication",
    ],
}


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


class NotificationStrategy(Protocol):
    """
    A strategy for determining which targets to send a notification to.
    """

    def get_targets(self) -> list[NotificationTarget]: ...


class NotificationData(Protocol):
    """
    All data passing through the notification platform must adhere to this protocol.
    """

    source: str
    """
    The source is uniquely attributable to the way this notification was sent. It will be tracked in
    metrics/analytics to determine the egress from a given code-path or service.
    """


@dataclass(frozen=True)
class NotificationRenderedAction:
    """
    A rendered action for an integration.
    """

    label: str
    """
    The text content of the action (usually appears as a button).
    This string should not contain any formatting, and will be displayed as is.
    """
    link: str
    """
    The underlying link of the action.
    """


@dataclass(frozen=True)
class NotificationRenderedImage:
    """
    An image that will be displayed in the notification.
    """

    url: str
    """
    The URL of the image.
    """
    alt_text: str
    """
    The alt text of the image.
    """


@dataclass(frozen=True)
class NotificationRenderedTemplate:
    subject: str
    """
    The subject or title of the notification. It's expected that the receiver understand the
    expected content of the notification based on this alone, and it will be the first thing
    they see. This string should not contain any formatting, and will be displayed as is.
    """
    body: str
    """
    The full contents of the notification. Put the details of the notification here, but consider
    keeping it concise and useful to the receiver. This string should not contain any formatting,
    and will be displayed as is.
    """
    actions: list[NotificationRenderedAction] = field(default_factory=list)
    """
    The list of actions that a receiver may take after having received the notification.
    """
    chart: NotificationRenderedImage | None = None
    """
    The image that will be displayed in the notification.
    """
    footer: str | None = None
    """
    Extra notification content that will appear after any actions, separate from the body. Optional,
    and consider omitting if the extra data is not necessary for your notification to be useful.
    This string should not contain any formatting, and will be displayed as is.
    """

    # The following are optional, as omitting them will use a default email template which expects
    # the required fields above to be present instead.
    email_html_path: str | None = None
    """
    The email HTML template file path. The associated NotificationData will be passed as context.
    In general, try to avoid including different information in these Django Templates than appear
    in the required fields, as it will make the contents of your notification vary from email to other
    providers.
    """
    email_text_path: str | None = None
    """
    The email text template file path. The associated NotificationData will be passed as context.
    In general, try to avoid including different information in these Django Templates than appear
    in the required fields, as it will make the contents of your notification vary from email to other
    providers.
    """


class NotificationTemplate[T: NotificationData](abc.ABC):
    category: NotificationCategory
    """
    The category that a notification belongs to. This will be used to determine which settings a
    user needs to modify to manage receipt of these notifications (if applicable).
    """
    example_data: T
    """
    The example data for this notification.
    """

    @abc.abstractmethod
    def render(self, data: T) -> NotificationRenderedTemplate:
        """
        Produce a rendered template given the notification data. Usually, this will involve
        formatting the data into user-friendly strings of text.
        """
        ...

    def render_example(self) -> NotificationRenderedTemplate:
        """
        Used to produce a debugging example rendered template for this notification. This
        implementation should be pure, and not populate with any live data.
        """
        return self.render(data=self.example_data)
