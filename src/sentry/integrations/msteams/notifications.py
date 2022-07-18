from __future__ import annotations

import logging
from typing import Any, Iterable, Mapping

import sentry_sdk

from sentry.integrations.notifications import get_context, get_integrations_by_channel_by_recipient
from sentry.models import Team, User
from sentry.notifications.notifications.activity.note import NoteActivityNotification
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.types.integrations import ExternalProviders
from sentry.utils import metrics

from .card_builder.notifications import MSTeamsNotificationsMessageBuilder
from .client import MsTeamsClient

logger = logging.getLogger("sentry.notifications.msteams")


SUPPORTED_NOTIFICATION_TYPES = [NoteActivityNotification]


def is_supported_notification_type(notification: BaseNotification) -> bool:
    return any(
        [
            isinstance(notification, notification_type)
            for notification_type in SUPPORTED_NOTIFICATION_TYPES
        ]
    )


@register_notification_provider(ExternalProviders.MSTEAMS)
def send_notification_as_msteams(
    notification: BaseNotification,
    recipients: Iterable[Team | User],
    shared_context: Mapping[str, Any],
    extra_context_by_actor_id: Mapping[int, Mapping[str, Any]] | None,
):
    if not is_supported_notification_type(notification):
        logger.info(f"Unsupported notification type for Microsoft Teams {notification}")
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
                extra_context = (extra_context_by_actor_id or {}).get(recipient.id, {})
                context = get_context(notification, recipient, shared_context, extra_context)

                with sentry_sdk.start_span(
                    op="notification.send_msteams", description="gen_attachments"
                ):
                    card = MSTeamsNotificationsMessageBuilder(
                        notification, context, recipient
                    ).build()

                for channel, integration in integrations_by_channel.items():
                    client = MsTeamsClient(integration)
                    conversation_id = client.get_user_conversation_id(
                        channel, integration.metadata["tenant_id"]
                    )

                    client.send_card(conversation_id, card)

    metrics.incr(
        f"{notification.metrics_key}.notifications.sent",
        instance=f"msteams.{notification.metrics_key}.notification",
        skip_internal=False,
    )
