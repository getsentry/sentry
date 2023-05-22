from __future__ import annotations

import logging
from copy import copy
from typing import Any, Iterable, List, Mapping

import sentry_sdk

from sentry.integrations.mixins import NotifyBasicMixin
from sentry.integrations.notifications import get_context, get_integrations_by_channel_by_recipient
from sentry.integrations.slack.message_builder import SlackAttachment
from sentry.integrations.slack.message_builder.notifications import get_message_builder
from sentry.models import Integration
from sentry.notifications.additional_attachment_manager import get_additional_attachment
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.shared_integrations.exceptions import ApiError
from sentry.tasks.integrations.slack import post_message
from sentry.types.integrations import ExternalProviders
from sentry.utils import json, metrics

logger = logging.getLogger("sentry.notifications")
SLACK_TIMEOUT = 5


class SlackNotifyBasicMixin(NotifyBasicMixin):  # type: ignore
    def send_message(self, channel_id: str, message: str) -> None:
        payload = {"channel": channel_id, "text": message}
        try:
            self.get_client().post("/chat.postMessage", data=payload, json=True)
        except ApiError as e:
            message = str(e)
            if message != "Expired url":
                logger.error("slack.slash-notify.response-error", extra={"error": message})


def _get_attachments(
    notification: BaseNotification,
    recipient: RpcActor,
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[RpcActor, Mapping[str, Any]] | None,
) -> List[SlackAttachment]:
    extra_context = (
        extra_context_by_actor[recipient] if extra_context_by_actor and recipient else {}
    )
    context = get_context(notification, recipient, shared_context, extra_context)
    cls = get_message_builder(notification.message_builder)
    attachments = cls(notification, context, recipient).build()
    if isinstance(attachments, List):
        return attachments
    return [attachments]


def _notify_recipient(
    notification: BaseNotification,
    recipient: RpcActor,
    attachments: List[SlackAttachment],
    channel: str,
    integration: Integration,
    shared_context: Mapping[str, Any],
) -> None:
    with sentry_sdk.start_span(op="notification.send_slack", description="notify_recipient"):
        # Make a local copy to which we can append.
        local_attachments = copy(attachments)

        # Add optional billing related attachment.
        additional_attachment = get_additional_attachment(integration, notification.organization)
        if additional_attachment:
            local_attachments.append(additional_attachment)

        # unfurl_links and unfurl_media are needed to preserve the intended message format
        # and prevent the app from replying with help text to the unfurl
        payload = {
            "channel": channel,
            "link_names": 1,
            "unfurl_links": False,
            "unfurl_media": False,
            "text": notification.get_notification_title(ExternalProviders.SLACK, shared_context),
            "attachments": json.dumps(local_attachments),
        }

        log_params = {
            "notification": notification,
            "recipient": recipient.id,
            "channel_id": channel,
        }
        post_message.apply_async(
            kwargs={
                "integration_id": integration.id,
                "payload": payload,
                "log_error_message": "notification.fail.slack_post",
                "log_params": log_params,
            }
        )
    # recording data outside of span
    notification.record_notification_sent(recipient, ExternalProviders.SLACK)


@register_notification_provider(ExternalProviders.SLACK)
def send_notification_as_slack(
    notification: BaseNotification,
    recipients: Iterable[RpcActor],
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[RpcActor, Mapping[str, Any]] | None,
) -> None:
    """Send an "activity" or "alert rule" notification to a Slack user or team, but NOT to a channel directly.
    Sending Slack notifications to a channel is in integrations/slack/actions/notification.py"""
    with sentry_sdk.start_span(
        op="notification.send_slack", description="gen_channel_integration_map"
    ):
        data = get_integrations_by_channel_by_recipient(
            notification.organization, recipients, ExternalProviders.SLACK
        )

    for recipient, integrations_by_channel in data.items():
        with sentry_sdk.start_span(op="notification.send_slack", description="send_one"):
            with sentry_sdk.start_span(op="notification.send_slack", description="gen_attachments"):
                attachments = _get_attachments(
                    notification,
                    recipient,
                    shared_context,
                    extra_context_by_actor,
                )

            for channel, integration in integrations_by_channel.items():
                _notify_recipient(
                    notification=notification,
                    recipient=recipient,
                    attachments=attachments,
                    channel=channel,
                    integration=integration,
                    shared_context=shared_context,
                )

    metrics.incr(
        f"{notification.metrics_key}.notifications.sent",
        instance=f"slack.{notification.metrics_key}.notification",
        skip_internal=False,
    )
