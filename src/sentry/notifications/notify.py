from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping, MutableMapping
from typing import Any, Optional, TypeVar

from sentry.integrations.types import ExternalProviders
from sentry.notifications.notifications.base import BaseNotification
from sentry.types.actor import Actor

# Shortcut so that types don't explode.
NotifyCallable = Callable[
    [
        BaseNotification,
        Iterable[Actor],
        Mapping[str, Any],
        Optional[Mapping[Actor, Mapping[str, Any]]],
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
    recipients: Iterable[Actor],
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[Actor, Mapping[str, Any]] | None = None,
) -> None:
    """Send notifications to these users or team."""

    registry[provider](notification, recipients, shared_context, extra_context_by_actor)
