from typing import TYPE_CHECKING, Protocol

from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
    NotificationType,
)
from sentry.organizations.services.organization.model import RpcOrganizationSummary

if TYPE_CHECKING:
    from sentry.notifications.platform.renderer import NotificationRenderer
    from sentry.notifications.platform.target import NotificationTarget


class NotificationProviderError(Exception):
    pass


class NotificationProvider[RenderableT](Protocol):
    """
    A protocol metaclass for all notification providers.

    RenderableT is a type used to send to the notification provider
    For example, Email might expect HTML, or raw text; Slack might expect a JSON Block Kit object.
    """

    key: NotificationProviderKey
    default_renderer: type["NotificationRenderer[RenderableT]"]
    target_class: type["NotificationTarget"]
    target_resource_types: list[NotificationTargetResourceType]

    @classmethod
    def validate_target(cls, *, target: "NotificationTarget") -> None:
        """
        Validates that a given target is permissible for the provider.
        """
        if not isinstance(target, cls.target_class):
            raise NotificationProviderError(
                f"Target '{target.__class__.__name__}' is not a valid dataclass for {cls.__name__}"
            )

        if target.provider_key != cls.key:
            raise NotificationProviderError(
                f"Target intended for '{target.provider_key}' provider was given to {cls.__name__}"
            )

        if target.resource_type not in cls.target_resource_types:
            raise NotificationProviderError(
                f"Target with resource type '{target.resource_type}' is not supported by {cls.__name__}"
                f"Supported resource types: {', '.join(t.value for t in cls.target_resource_types)}"
            )

        return

    @classmethod
    def get_renderer(cls, *, type: NotificationType) -> type["NotificationRenderer[RenderableT]"]:
        """
        Returns the renderer for a given notification type, falling back to the default renderer.
        Override this to method to permit different renderers for the provider, though keep in mind
        that this may produce inconsistencies between notifications.
        """
        return cls.default_renderer

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        """
        Returns `True` if the provider is available given the key word arguments.
        """
        ...
