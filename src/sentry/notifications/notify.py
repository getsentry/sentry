from typing import Any, Callable, Iterable, Mapping, MutableMapping, Optional, Set, Union

from sentry.models import Team, User
from sentry.types.integrations import ExternalProviders

# Shortcut so that types don't explode.
Notifiable = Callable[
    [
        Any,
        Union[Set[User], Set[Team]],
        Mapping[str, Any],
        Optional[Mapping[int, Mapping[str, Any]]],
    ],
    None,
]

# Global notifier registry.
registry: MutableMapping[ExternalProviders, Notifiable] = {}


def notification_providers() -> Iterable[ExternalProviders]:
    """ Get a set of providers that can call notify. """
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
    recipients: Union[Set[User], Set[Team]],
    shared_context: Mapping[str, Any],
    extra_context_by_user_id: Optional[Mapping[int, Mapping[str, Any]]] = None,
) -> None:
    """ Send notifications to these users or team. """
    registry[provider](notification, recipients, shared_context, extra_context_by_user_id)
