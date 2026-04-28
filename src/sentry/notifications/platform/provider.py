from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Protocol

from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.threading import ThreadContext
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationProviderKey,
    NotificationTarget,
    NotificationTargetResourceType,
)
from sentry.organizations.services.organization.model import RpcOrganizationSummary
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError


class NotificationProviderError(Exception):
    pass


type SendResult = SendSuccessResult | SendFailure


class SendFailureStatus(Enum):
    HALT = "halt"
    """A known configuration or access issue — not actionable by our team."""
    FAILURE = "failure"
    """An unexpected error — should be investigated."""


@dataclass(frozen=True)
class ProviderThreadingContext:
    """
    Base class for provider-specific threading context passed to integration clients.
    Each provider subclasses this with its own fields (e.g., Slack adds thread_ts).
    """

    reply_broadcast: bool = False


@dataclass(frozen=True)
class SendSuccessResult:
    """Successful send outcome."""

    provider_message_id: str | None = None
    """Provider-specific message identifier (e.g., Slack's `ts`)."""

    is_threaded: bool = False
    """Whether the notification was sent with threading."""


@dataclass(frozen=True)
class SendFailure:
    """Failed send outcome (halt or unexpected failure)."""

    status: SendFailureStatus
    is_threaded: bool = False
    exception: Exception | None = None
    """The exception that caused the failure, for lifecycle recording."""
    error_code: int | None = None
    """HTTP status code or provider error code."""
    error_details: dict[str, Any] | None = None
    """Extra debugging context — logged, not used for control flow."""


def integration_error_result(e: IntegrationError, *, is_threaded: bool = False) -> SendFailure:
    """Maps an IntegrationError to a SendFailure with the appropriate status.

    Shared by all integration-backed notification providers.
    """
    if isinstance(e, IntegrationConfigurationError):
        status = SendFailureStatus.HALT
    else:
        status = SendFailureStatus.FAILURE
    return SendFailure(
        status=status,
        exception=e,
        error_code=e.error_code,
        is_threaded=is_threaded,
    )


class IntegrationNotificationClient[RenderableT, ThreadingResponseT = dict[str, Any]](Protocol):
    def send_notification(
        self, target: IntegrationNotificationTarget, payload: RenderableT
    ) -> None: ...

    def send_notification_with_threading(
        self,
        target: IntegrationNotificationTarget,
        payload: RenderableT,
        threading_context: ProviderThreadingContext,
    ) -> ThreadingResponseT: ...


class NotificationProvider[RenderableT](Protocol):
    """
    A protocol metaclass for all notification providers.

    RenderableT is a type used to send to the notification provider
    For example, Email might expect HTML, or raw text; Slack might expect a JSON Block Kit object.
    """

    key: NotificationProviderKey
    default_renderer: type[NotificationRenderer[RenderableT]]
    target_class: type[NotificationTarget]
    target_resource_types: list[NotificationTargetResourceType]

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
        cls, *, data: NotificationData, category: NotificationCategory
    ) -> type[NotificationRenderer[RenderableT]]:
        """
        Returns an instance of a renderer for a given notification, falling back to the default renderer.
        Override this to method to permit different renderers for the provider, though keep in mind
        that this may produce inconsistencies between notifications.
        """
        return cls.default_renderer

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        """
        Returns `True` if the provider is available given the key word arguments.
        This could be used for
        - Feature flag checking/rollout
        - Any other provider specific checks related to the organization
        """
        ...

    @classmethod
    def send(
        cls,
        *,
        target: NotificationTarget,
        renderable: RenderableT,
        thread_context: ThreadContext | None = None,
    ) -> SendResult:
        """
        Using the renderable format for the provider, send a notification to the target.

        If thread_context is provided, delegates to _send_with_threading.
        Returns a SendResult with the provider-specific message identifier on success,
        or error details on failure.
        """
        ...
