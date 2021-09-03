import logging
from collections import defaultdict
from typing import AbstractSet, Any, Mapping, MutableMapping, Optional, Set, Union

from sentry import analytics
from sentry.models import Organization, Team, User
from sentry.notifications.integrations import (
    get_channel_and_integration_by_team,
    get_channel_and_integration_by_user,
    get_context,
    get_key,
)
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.types.integrations import ExternalProviders
from sentry.utils import metrics

from .card_builder.notifications import MSTeamsNotificationsMessageBuilder
from .client import MsTeamsClient

logger = logging.getLogger("sentry.notifications")
MSTEAMS_TIMEOUT = 5


def get_channel_and_integration_by_recipient(
    organization: Organization, recipients: AbstractSet[Union[User, Team]]
) -> Mapping[Union[User, Team], Mapping[str, str]]:
    output: MutableMapping[Union[User, Team], MutableMapping[str, str]] = defaultdict(dict)
    for recipient in recipients:
        channels_to_integrations = (
            get_channel_and_integration_by_user(recipient, organization, ExternalProviders.MSTEAMS)
            if isinstance(recipient, User)
            else get_channel_and_integration_by_team(
                recipient, organization, ExternalProviders.MSTEAMS
            )
        )
        for channel, integration in channels_to_integrations.items():
            output[recipient][channel] = integration
    return output


@register_notification_provider(ExternalProviders.MSTEAMS)
def send_notification_as_msteams(
    notification: BaseNotification,
    recipients: Union[Set[User], Set[Team]],
    shared_context: Mapping[str, Any],
    extra_context_by_user_id: Optional[Mapping[int, Mapping[str, Any]]],
) -> None:
    """Send an "activity" or "alert rule" notification to a MSTeams user or team."""
    data = get_channel_and_integration_by_recipient(notification.organization, recipients)
    for recipient, integrations_by_channel in data.items():
        is_multiple = (
            True if len([integration for integration in integrations_by_channel]) > 1 else False
        )
        if is_multiple:
            logger.info(
                "notification.multiple.msteams_post",
                extra={
                    "notification": notification,
                    "recipient": recipient.id,
                },
            )
        extra_context = (extra_context_by_user_id or {}).get(recipient.id, {})
        context = get_context(notification, recipient, shared_context, extra_context)
        card = MSTeamsNotificationsMessageBuilder(notification, context, recipient).build()
        for channel, integration in integrations_by_channel.items():
            client = MsTeamsClient(integration)
            client.send_card(channel, card)
            analytics.record(
                "integrations.msteams.notification_sent",
                organization_id=notification.organization.id,
                project_id=notification.project.id,
                category=notification.get_category(),
                actor_id=recipient.actor_id,
            )

    key = get_key(notification)
    metrics.incr(
        f"{key}.notifications.sent",
        instance=f"msteams.{key}.notification",
        skip_internal=False,
    )
