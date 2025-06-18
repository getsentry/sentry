from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol

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
    default_renderer: NotificationRenderer[RenderableT]
    target_class: type[NotificationTarget]
    target_resource_types: list[NotificationTargetResourceType]

    @classmethod
    def dispatch_notification(
        cls,
        *,
        target: NotificationTarget,
        template: Any,
        data: Any,
        thread_id: str | None = None,
    ) -> None:
        renderer = cls.get_renderer(notification_type=template.notification_type)
        notification_content = renderer.render(data=data, template=template)
        cls._send_notification(
            notification_content=notification_content,
            notification_type=template.notification_type,
            target=target,
            thread_id=thread_id,
        )

    @classmethod
    def validate_target(cls, *, target: NotificationTarget) -> None:
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
    def get_renderer(
        cls, *, notification_type: NotificationType
    ) -> NotificationRenderer[RenderableT]:
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
        raise NotImplementedError("Subclasses must implement this method")

    @classmethod
    def _send_notification(
        cls,
        *,
        notification_content: RenderableT,
        notification_type: NotificationType,
        target: NotificationTarget,
        thread_id: str | None = None,
    ) -> None:
        """
        Sends a notification to the given target.
        """
        raise NotImplementedError("Subclasses must implement this method")
