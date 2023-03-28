from __future__ import annotations

from typing import Any, Callable, Iterable, Mapping, MutableMapping, Optional, Union

from sentry.models import Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo.base import SiloMode
from sentry.types.integrations import ExternalProviders

# Shortcut so that types don't explode.
Notifiable = Callable[
    [
        BaseNotification,
        Iterable[Union[RpcActor, Team, User, RpcUser]],
        Mapping[str, Any],
        Optional[Mapping[int, Mapping[str, Any]]],
    ],
    None,
]

# Global notifier registry.
registry: MutableMapping[ExternalProviders, Notifiable] = {}


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
    recipients: Iterable[RpcActor | Team | RpcUser],
    shared_context: Mapping[str, Any],
    extra_context_by_actor_id: Mapping[int, Mapping[str, Any]] | None = None,
) -> None:
    """Send notifications to these users or team."""

    """ ###################### Begin Hack ######################
    # Temporary Hybrid Cloud hack that isolates the notification subsystem from RpcUser
    # and RpcActor type changes. With this in place, we can assert that changes so far
    # don't affect Notification system behavior (only possibly who receives
    # notifications). This will be removed in future work.

    # Create a new list of recipients that are full Team and User objects (as opposed to RpcUser)
    """
    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        user_ids = []
        team_ids = []
        new_recipients = []
        for r in recipients:
            if isinstance(r, RpcActor):
                if r.actor_type == ActorType.USER:
                    user_ids.append(r.id)
                if r.actor_type == ActorType.TEAM:
                    team_ids.append(r.id)
            elif isinstance(r, RpcUser):
                user_ids.append(r.id)
            else:
                new_recipients.append(r)
        if user_ids:
            new_recipients += list(User.objects.filter(id__in=user_ids))
        if team_ids:
            new_recipients += list(Team.objects.filter(id__in=team_ids))
        recipients = new_recipients
    """ ###################### End Hack ###################### """
    registry[provider](notification, recipients, shared_context, extra_context_by_actor_id)
