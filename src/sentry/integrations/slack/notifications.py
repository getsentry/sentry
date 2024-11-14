from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping
from typing import Any

import sentry_sdk
from slack_sdk.errors import SlackApiError

from sentry.integrations.mixins import NotifyBasicMixin
from sentry.integrations.notifications import get_integrations_by_channel_by_recipient
from sentry.integrations.slack.metrics import (
    SLACK_NOTIFY_MIXIN_FAILURE_DATADOG_METRIC,
    SLACK_NOTIFY_MIXIN_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.service import SlackService
from sentry.integrations.slack.utils.errors import CHANNEL_NOT_FOUND, unpack_slack_api_error
from sentry.integrations.types import ExternalProviders
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.types.actor import Actor
from sentry.users.models.user import User
from sentry.utils import metrics

logger = logging.getLogger("sentry.notifications")
SLACK_TIMEOUT = 5


class SlackNotifyBasicMixin(NotifyBasicMixin):
    def send_message(self, channel_id: str, message: str) -> None:
        client = self.get_client()

        try:
            client.chat_postMessage(channel=channel_id, text=message)
            metrics.incr(SLACK_NOTIFY_MIXIN_SUCCESS_DATADOG_METRIC, sample_rate=1.0)
        except SlackApiError as e:
            metrics.incr(SLACK_NOTIFY_MIXIN_FAILURE_DATADOG_METRIC, sample_rate=1.0)

            # TODO: remove this
            if unpack_slack_api_error(e) != CHANNEL_NOT_FOUND:
                logger.exception(
                    "slack.slash-response.error",
                    extra={"error": str(e)},
                )


@register_notification_provider(ExternalProviders.SLACK)
def send_notification_as_slack(
    notification: BaseNotification,
    recipients: Iterable[Actor | User],
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[Actor, Mapping[str, Any]] | None,
) -> None:
    """Send an "activity" or "alert rule" notification to a Slack user or team, but NOT to a channel directly.
    Sending Slack notifications to a channel is in integrations/slack/actions/notification.py"""

    service = SlackService.default()
    with sentry_sdk.start_span(op="notification.send_slack", name="gen_channel_integration_map"):
        data = get_integrations_by_channel_by_recipient(
            notification.organization, recipients, ExternalProviders.SLACK
        )

    for recipient, integrations_by_channel in data.items():
        with sentry_sdk.start_span(op="notification.send_slack", name="send_one"):
            with sentry_sdk.start_span(op="notification.send_slack", name="gen_attachments"):
                attachments = service.get_attachments(
                    notification,
                    recipient,
                    shared_context,
                    extra_context_by_actor,
                )

            for channel, integration in integrations_by_channel.items():
                service.notify_recipient(
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
