from dataclasses import dataclass, field
from typing import Any

from sentry.integrations.services.integration.model import (
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTarget,
    NotificationTargetResourceType,
)


class NotificationTargetError(Exception):
    pass


@dataclass(kw_only=True, frozen=True)
class GenericNotificationTarget(NotificationTarget):
    """
    A designated recipient for a notification. This could be a user, a team, or a channel.
    Accepts the renderable object type that matches the connected provider.
    """

    is_prepared: bool = field(init=False, default=False)
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
class IntegrationNotificationTarget(GenericNotificationTarget):
    """
    Adds necessary properties and methods to designate a target within an integration.
    Accepts the renderable object type that matches the connected provider.
    """

    integration_id: int
    organization_id: int
    integration: RpcIntegration = field(init=False)
    """
    The integration associated with the target, must call `prepare_targets` to populate.
    """
    organization_integration: RpcOrganizationIntegration = field(init=False)
    """
    The integration associated with the target, must call `prepare_targets` to populate.
    """


def prepare_targets(targets: list[NotificationTarget]) -> None:
    """
    This method is used to prepare the targets for receiving a notification.
    For example, with IntegrationNotificationTargets, this will populate the `integration` and
    `organization_integration` fields by making RPC/DB calls.
    """
    for target in targets:
        object.__setattr__(target, "is_prepared", True)
