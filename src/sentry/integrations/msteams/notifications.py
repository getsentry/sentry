from __future__ import annotations

import logging
from typing import Any, Iterable, Mapping

import sentry_sdk

from sentry.integrations.msteams.card_builder.block import AdaptiveCard
from sentry.integrations.msteams.utils import get_user_conversation_id
from sentry.integrations.notifications import get_context, get_integrations_by_channel_by_recipient
from sentry.models.team import Team
from sentry.models.user import User
from sentry.notifications.notifications.activity.assigned import AssignedActivityNotification
from sentry.notifications.notifications.activity.escalating import EscalatingActivityNotification
from sentry.notifications.notifications.activity.note import NoteActivityNotification
from sentry.notifications.notifications.activity.regression import RegressionActivityNotification
from sentry.notifications.notifications.activity.release import ReleaseActivityNotification
from sentry.notifications.notifications.activity.resolved import ResolvedActivityNotification
from sentry.notifications.notifications.activity.resolved_in_release import (
    ResolvedInReleaseActivityNotification,
)
from sentry.notifications.notifications.activity.unassigned import UnassignedActivityNotification
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.notifications.notify import register_notification_provider
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders
from sentry.utils import metrics

from .card_builder.notifications import (
    MSTeamsIssueNotificationsMessageBuilder,
    MSTeamsNotificationsMessageBuilder,
)
from .client import MsTeamsClient

logger = logging.getLogger("sentry.notifications.msteams")

SUPPORTED_NOTIFICATION_TYPES = [
    NoteActivityNotification,
    AssignedActivityNotification,
    UnassignedActivityNotification,
    AlertRuleNotification,
    ResolvedActivityNotification,
    ResolvedInReleaseActivityNotification,
    ReleaseActivityNotification,
    RegressionActivityNotification,
    EscalatingActivityNotification,
]
MESSAGE_BUILDERS = {
    "SlackNotificationsMessageBuilder": MSTeamsNotificationsMessageBuilder,
    "IssueNotificationMessageBuilder": MSTeamsIssueNotificationsMessageBuilder,
}


def is_supported_notification_type(notification: BaseNotification) -> bool:
    return any(
        [
            isinstance(notification, notification_type)
            for notification_type in SUPPORTED_NOTIFICATION_TYPES
        ]
    )


def get_notification_card(
    notification: BaseNotification, context: Mapping[str, Any], recipient: User | Team | RpcActor
) -> AdaptiveCard:
    cls = MESSAGE_BUILDERS[notification.message_builder]
    return cls(notification, context, recipient).build_notification_card()


@register_notification_provider(ExternalProviders.MSTEAMS)
def send_notification_as_msteams(
    notification: BaseNotification,
    recipients: Iterable[RpcActor],
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[RpcActor, Mapping[str, Any]] | None,
):
    if not is_supported_notification_type(notification):
        logger.info(
            "Unsupported notification type for Microsoft Teams %s", notification.__class__.__name__
        )
        return

    with sentry_sdk.start_span(
        op="notification.send_msteams", description="gen_channel_integration_map"
    ):
        data = get_integrations_by_channel_by_recipient(
            organization=notification.organization,
            recipients=recipients,
            provider=ExternalProviders.MSTEAMS,
        )

        for recipient, integrations_by_channel in data.items():
            with sentry_sdk.start_span(op="notification.send_msteams", description="send_one"):
                extra_context = (extra_context_by_actor or {}).get(recipient, {})
                context = get_context(notification, recipient, shared_context, extra_context)

                with sentry_sdk.start_span(
                    op="notification.send_msteams", description="gen_attachments"
                ):
                    card = get_notification_card(notification, context, recipient)

                for channel, integration in integrations_by_channel.items():
                    conversation_id = get_user_conversation_id(integration, channel)

                    client = MsTeamsClient(integration)
                    try:
                        with sentry_sdk.start_span(
                            op="notification.send_msteams", description="notify_recipient"
                        ):
                            client.send_card(conversation_id, card)

                        notification.record_notification_sent(recipient, ExternalProviders.MSTEAMS)
                    except Exception:
                        logger.exception("Exception occured while trying to send the notification")

    metrics.incr(
        f"{notification.metrics_key}.notifications.sent",
        instance=f"msteams.{notification.metrics_key}.notification",
        skip_internal=False,
    )
