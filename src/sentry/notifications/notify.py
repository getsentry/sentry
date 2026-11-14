from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping, MutableMapping
from typing import Any

from sentry.integrations.types import ExternalProviders
from sentry.notifications.notifications.base import BaseNotification
from sentry.types.actor import Actor

# Each notification class builds its own template context, so the shared
# mapping cannot be a single schema. Providers look up keys they understand.
type NotificationContext = Mapping[str, Any]
type ActorNotificationContext = Mapping[Actor, NotificationContext]

# Shortcut so that types don't explode.
NotifyCallable = Callable[
    [
        BaseNotification,
        Iterable[Actor],
        NotificationContext,
        ActorNotificationContext | None,
    ],
    None,
]

# Global notifier registry.
registry: MutableMapping[ExternalProviders, NotifyCallable] = {}


def notification_providers() -> Iterable[ExternalProviders]:
    """Get a set of providers that can call notify."""
    return registry.keys()


def register_notification_provider[Notifiable: NotifyCallable](
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
    notification: BaseNotification,
    recipients: Iterable[Actor],
    shared_context: NotificationContext,
    extra_context_by_actor: ActorNotificationContext | None = None,
) -> None:
    """Send notifications to these users or team."""

    registry[provider](notification, recipients, shared_context, extra_context_by_actor)
