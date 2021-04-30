from typing import Any, Callable, Iterable, Mapping, MutableMapping, Set

from sentry.types.integrations import ExternalProviders

# Shortcut so that types don't explode.
Notifiable = Callable[[Any, Set[int], Mapping[str, Any]], None]

# Global notifier registry.
registry: MutableMapping[ExternalProviders, Notifiable] = {}

APPROVED_PROVIDERS = [ExternalProviders.EMAIL, ExternalProviders.SLACK]


def notification_providers() -> Iterable[ExternalProviders]:
    """ Get a set of providers that can call notify. """
    return registry.keys()


def register_issue_notification_provider(
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


def notify_participants(
    notification: Any,
    provider: ExternalProviders,
    users: Set[int],
    shared_context: Mapping[str, Any],
) -> None:
    """ Send notifications to these users. """
    if provider in APPROVED_PROVIDERS:
        registry[provider](notification, users, shared_context)
