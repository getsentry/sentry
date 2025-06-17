from dataclasses import dataclass, field
from typing import Any

from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)


@dataclass(kw_only=True, frozen=True)
class NotificationTarget:
    """
    A designated recipient for a notification. This could be a user, a team, or a channel.
    Accepts the renderable object type that matches the connected provider.
    """

    provider_key: NotificationProviderKey
    resource_type: NotificationTargetResourceType
    resource_id: str
    """
    The identifier that a provider can use to access or send to the given resource.
    For example, an email address, a slack channel ID, a discord user ID, etc.
    """
    specific_data: dict[str, Any] | None = field(default=None)
    """
    Arbitrary data that is specific to the target; for example, a link to a user's notification settings.

    When possible, consider whether this is really necessary as it produces inconsistencies across recipients, which may be lead to confusion.
    If all targets use the same payload, please add this to the NotificationTemplate instead.
    """


@dataclass(kw_only=True, frozen=True)
class IntegrationNotificationTarget(NotificationTarget):
    """
    Adds necessary properties and methods to designate a target within an integration.
    Accepts the renderable object type that matches the connected provider.
    """

    integration_id: int
    organization_id: int
