from __future__ import annotations

from typing import Any, Callable, Iterable, Mapping, MutableMapping, Optional, TypeVar

from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders

# Shortcut so that types don't explode.
NotifyCallable = Callable[
    [
        BaseNotification,
        Iterable[RpcActor],
        Mapping[str, Any],
        Optional[Mapping[RpcActor, Mapping[str, Any]]],
    ],
    None,
]
Notifiable = TypeVar("Notifiable", bound=NotifyCallable)

# Global notifier registry.
registry: MutableMapping[ExternalProviders, NotifyCallable] = {}


def notification_providers() -> Iterable[ExternalProviders]:
    """Get a set of providers that can call notify."""
    return registry.keys()


def register_notification_provider(
    provider: ExternalProviders,
) -> Callable[[Notifiable], Notifiable]:
    """
    A wrapper that adds the wrapped function to the send_notification_registry
    (see above) for the provider.
    """

    def wrapped(send_notification: Notifiable) -> Notifiable:
        registry[provider] = send_notification
        return send_notification

    return wrapped


def notify(
    provider: ExternalProviders,
    notification: Any,
    recipients: Iterable[RpcActor],
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[RpcActor, Mapping[str, Any]] | None = None,
) -> None:
    """Send notifications to these users or team."""

    registry[provider](notification, recipients, shared_context, extra_context_by_actor)
